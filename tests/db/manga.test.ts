// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, rows, signUp, type Db } from "./harness";

let db: Db;
let ana: string;
let ben: string;
let mod: string;

beforeAll(async () => {
  db = await createDb();
  ana = await signUp(db, "ana@example.test", { username: "ana" });
  ben = await signUp(db, "ben@example.test", { username: "ben" });
  mod = await signUp(db, "mod@example.test", { username: "mod" });
  await db.query("insert into moderators (user_id) values ($1)", [mod]);
}, 60_000);

const addManga = (user: string, id = 101517, status = "CURRENT") =>
  db.query("insert into manga_library_entries (user_id, manga_id, status, progress, media_snapshot) values ($1, $2, $3, 12, '{\"title\":\"Jujutsu Kaisen\"}')", [user, id, status]);

const mapping = (over: Record<string, unknown> = {}) => {
  const m = {
    id: "test-s1",
    franchise: "test",
    anime_id: 1,
    anime_season_identifier: "s1",
    anime_label: "Temporada 1",
    anime_format: "TV",
    manga_id: 2,
    relation: "faithful",
    verification_status: "verified",
    continuation_chapter: "10",
    recommended_start_chapter: "10",
    verified_at: new Date().toISOString(),
    basis: null,
    ...over,
  };
  const cols = Object.keys(m);
  return db.query(`insert into anime_manga_adaptation_mappings (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")})`, Object.values(m));
};

describe("manga schema", () => {
  it("is additive: existing settings rows gain an empty reader column", async () => {
    const r = await rows<{ reader: Record<string, unknown> }>(db, "select reader from user_settings where user_id = $1", [ana]);
    expect(r[0].reader).toEqual({});
  });

  it("lets owners write their manga library and follows the lists privacy facet", async () => {
    await as(db, ana, () => addManga(ana));
    await as(db, ben, async () => {
      expect(await rows(db, "select * from manga_library_entries where user_id = $1", [ana])).toHaveLength(1);
      await expect(addManga(ana, 5)).rejects.toThrow(/row-level security/);
    });
    await as(db, ana, () => db.query("update profiles set show_lists = false where id = $1", [ana]));
    await as(db, ben, async () => expect(await rows(db, "select * from manga_library_entries where user_id = $1", [ana])).toHaveLength(0));
    await as(db, ana, () => db.query("update profiles set show_lists = true where id = $1", [ana]));
  });

  it("keeps bookmarks and measured sessions private to their owner", async () => {
    await as(db, ana, async () => {
      await db.query("insert into manga_bookmarks (user_id, manga_id, chapter_id, page) values ($1, -1001, 'vdp-c1', 3)", [ana]);
      await db.query("insert into manga_reading_sessions (user_id, manga_id, chapter_id, started_at, ended_at, active_seconds, pages_viewed) values ($1, -1001, 'vdp-c1', now() - interval '5 min', now(), 240, 8)", [ana]);
    });
    await as(db, ben, async () => {
      expect(await rows(db, "select * from manga_bookmarks")).toHaveLength(0);
      expect(await rows(db, "select * from manga_reading_sessions")).toHaveLength(0);
    });
    await as(db, ana, async () => expect(await rows(db, "select * from manga_bookmarks")).toHaveLength(1));
  });

  it("feeds the existing activity feed, but never for demo series", async () => {
    const before = (await rows(db, "select * from activity_events where user_id = $1", [ana])).length;
    await as(db, ana, () => db.query("insert into manga_library_entries (user_id, manga_id, status, media_snapshot) values ($1, -1002, 'CURRENT', '{}')", [ana]));
    expect((await rows(db, "select * from activity_events where user_id = $1", [ana])).length).toBe(before);
    await as(db, ana, () => db.query("update manga_library_entries set status = 'COMPLETED' where user_id = $1 and manga_id = 101517", [ana]));
    const ev = await rows<{ kind: string; media_snapshot: { kind: string } }>(db, "select kind, media_snapshot from activity_events where user_id = $1 order by created_at desc limit 1", [ana]);
    expect(ev[0].kind).toBe("completed");
    expect(ev[0].media_snapshot.kind).toBe("manga");
  });
});

describe("adaptation mappings", () => {
  it("refuses 'verified' without evidence and 'unknown' with a chapter", async () => {
    await expect(mapping({ id: "bad-verified", verified_at: null })).rejects.toThrow(/check/i);
    await expect(mapping({ id: "bad-unknown", anime_season_identifier: "s9", verification_status: "unknown", verified_at: null })).rejects.toThrow(/check/i);
    await expect(mapping({ id: "bad-approx", anime_season_identifier: "s8", verification_status: "approximate", verified_at: null })).rejects.toThrow(/check/i);
  });

  it("only moderators edit reviewed mappings, and every change is versioned", async () => {
    await as(db, ana, async () => {
      await expect(mapping({ id: "ana-try" })).rejects.toThrow(/row-level security/);
    });
    await as(db, mod, async () => {
      await mapping();
      await db.query("update anime_manga_adaptation_mappings set continuation_chapter = '11', recommended_start_chapter = '11' where id = 'test-s1'");
    });
    const m = await rows<{ revision: number }>(db, "select revision from anime_manga_adaptation_mappings where id = 'test-s1'");
    expect(m[0].revision).toBe(2);
    const rev = await rows<{ revision: number }>(db, "select revision from adaptation_mapping_revisions where mapping_id = 'test-s1' order by revision");
    expect(rev.map((r) => r.revision)).toEqual([1, 2]);
    await as(db, ana, async () => {
      expect(await rows(db, "select * from anime_manga_adaptation_mappings where id = 'test-s1'")).toHaveLength(1);
      expect(await rows(db, "select * from adaptation_mapping_revisions")).toHaveLength(0);
    });
  });

  it("accepts community submissions only as unreviewed 'pending' rows", async () => {
    const insert = (status = "pending") =>
      db.query("insert into adaptation_mapping_submissions (user_id, anime_id, anime_season_identifier, manga_id, continuation_chapter, source_urls, status) values ($1, 171018, 's1', 132029, '35', array['https://example.com/guide'], $2)", [ana, status]);
    await as(db, ana, async () => {
      await expect(insert("accepted")).rejects.toThrow(/row-level security/);
      await insert();
    });
    await as(db, ben, async () => expect(await rows(db, "select * from adaptation_mapping_submissions")).toHaveLength(0));
    const [{ id }] = await rows<{ id: string }>(db, "select id from adaptation_mapping_submissions limit 1");
    await as(db, ana, async () => {
      await expect(db.query("select review_adaptation_submission($1, true)", [id])).rejects.toThrow(/not allowed/);
    });
    await as(db, mod, () => db.query("select review_adaptation_submission($1, true, 'ok')", [id]));
    expect((await rows<{ status: string }>(db, "select status from adaptation_mapping_submissions where id = $1", [id]))[0].status).toBe("accepted");
  });
});
