// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, rows, signUp, type Db } from "./harness";

let db: Db;
let alice: string;
let bob: string;
let carol: string;

beforeAll(async () => {
  db = await createDb();
  alice = await signUp(db, "alice@example.test", { username: "alice", display_name: "Alice" });
  bob = await signUp(db, "bob@example.test", { username: "bob" });
  carol = await signUp(db, "carol@example.test", { username: "carol", theme: "zen" });
}, 60_000);

const entry = (user: string, media = 21) =>
  db.query("insert into anime_library_entries (user_id, media_id, status, progress, media_snapshot) values ($1, $2, 'CURRENT', 3, '{\"title\":\"One Piece\"}')", [user, media]);

describe("schema & seed", () => {
  it("bootstraps a profile and settings for every signup", async () => {
    const p = await rows<{ username: string; display_name: string }>(db, "select username, display_name from profiles where id = $1", [alice]);
    expect(p[0]).toEqual({ username: "alice", display_name: "Alice" });
    expect((await rows<{ theme: string }>(db, "select theme from user_settings where user_id = $1", [carol]))[0].theme).toBe("zen");
  });

  it("de-duplicates usernames on signup", async () => {
    const dup = await signUp(db, "alice@other.test", { username: "alice" });
    expect((await rows<{ username: string }>(db, "select username from profiles where id = $1", [dup]))[0].username).toBe("alice1");
  });

  it("seeds reference data only (no fake users or activity)", async () => {
    expect((await rows(db, "select * from achievements")).length).toBe(12);
    expect((await rows(db, "select * from reviews")).length).toBe(0);
    expect((await rows(db, "select * from activity_events")).length).toBe(0);
  });
});

describe("row level security", () => {
  it("lets owners manage their library and keeps notes private", async () => {
    await as(db, alice, async () => {
      await entry(alice);
      await db.query("insert into library_notes (user_id, media_id, notes) values ($1, 21, 'secret')", [alice]);
    });
    await as(db, bob, async () => {
      expect(await rows(db, "select * from anime_library_entries where user_id = $1", [alice])).toHaveLength(1);
      expect(await rows(db, "select * from library_notes where user_id = $1", [alice])).toHaveLength(0);
      await expect(entry(alice, 22)).rejects.toThrow(/row-level security/);
    });
  });

  it("hides lists when the owner turns sharing off or goes private", async () => {
    await as(db, alice, () => db.query("update profiles set show_lists = false where id = $1", [alice]));
    await as(db, bob, async () => expect(await rows(db, "select * from anime_library_entries where user_id = $1", [alice])).toHaveLength(0));
    await as(db, alice, () => db.query("update profiles set show_lists = true, visibility = 'friends' where id = $1", [alice]));
    await as(db, bob, async () => expect(await rows(db, "select * from anime_library_entries where user_id = $1", [alice])).toHaveLength(0));
    await as(db, null, async () => expect(await rows(db, "select * from anime_library_entries")).toHaveLength(0));
  });

  it("never exposes connected-account secrets to users", async () => {
    const [acct] = await rows<{ id: string }>(db, "insert into connected_accounts (user_id, provider, external_user_id, external_username) values ($1, 'anilist', '1', 'a') returning id", [alice]);
    await db.query("insert into connected_account_secrets (account_id, encrypted_token) values ($1, 'cipher')", [acct.id]);
    await as(db, alice, async () => {
      expect(await rows(db, "select * from connected_accounts")).toHaveLength(1);
      expect(await rows(db, "select * from connected_account_secrets")).toHaveLength(0);
    });
  });

  it("prevents users from editing other profiles", async () => {
    await as(db, bob, async () => {
      const r = await db.query("update profiles set bio = 'hacked' where id = $1", [alice]);
      expect(r.affectedRows).toBe(0);
    });
  });
});

describe("friends, privacy and blocking", () => {
  it("runs the request → notification → accept → friendship flow", async () => {
    const [{ send_friend_request: req }] = await as(db, bob, () => rows<{ send_friend_request: string }>(db, "select send_friend_request($1)", [alice]));
    const notes = await as(db, alice, () => rows<{ kind: string }>(db, "select kind from notifications where user_id = $1", [alice]));
    expect(notes.map((n) => n.kind)).toContain("friend_request");
    await as(db, bob, async () => {
      await expect(db.query("select respond_friend_request($1, true)", [req])).rejects.toThrow(/not allowed/);
    });
    await as(db, alice, () => db.query("select respond_friend_request($1, true)", [req]));
    expect((await rows<{ are_friends: boolean }>(db, "select are_friends($1, $2)", [alice, bob]))[0].are_friends).toBe(true);
  });

  it("shows friends-only lists to friends but not strangers", async () => {
    await as(db, bob, async () => expect(await rows(db, "select * from anime_library_entries where user_id = $1", [alice])).toHaveLength(1));
    await as(db, carol, async () => expect(await rows(db, "select * from anime_library_entries where user_id = $1", [alice])).toHaveLength(0));
  });

  it("emits activity from real library events and honours activity privacy", async () => {
    await as(db, alice, () => db.query("update anime_library_entries set status = 'COMPLETED' where user_id = $1 and media_id = 21", [alice]));
    const kinds = await as(db, bob, () => rows<{ kind: string }>(db, "select kind from activity_events where user_id = $1 order by created_at", [alice]));
    expect(kinds.map((k) => k.kind)).toEqual(["started", "completed"]);
    await as(db, alice, () => db.query("update profiles set show_activity = false where id = $1", [alice]));
    await as(db, bob, async () => expect(await rows(db, "select * from activity_events where user_id = $1", [alice])).toHaveLength(0));
    await as(db, alice, () => db.query("update profiles set show_activity = true where id = $1", [alice]));
  });

  it("blocking removes the friendship and hides the blocker's profile", async () => {
    await as(db, carol, () => db.query("select send_friend_request($1)", [bob]));
    await as(db, bob, () => db.query("select block_user($1)", [carol]));
    await as(db, carol, async () => {
      expect(await rows(db, "select * from profiles where id = $1", [bob])).toHaveLength(0);
      await expect(db.query("select send_friend_request($1)", [bob])).rejects.toThrow(/unavailable/);
    });
    expect(await rows(db, "select * from friend_requests where status = 'pending' and $1 in (sender_id, receiver_id)", [carol])).toHaveLength(0);
  });
});

describe("community", () => {
  let review: string;
  it("rejects forged counters and counts likes via triggers", async () => {
    await as(db, alice, async () => {
      await expect(
        db.query("insert into reviews (user_id, media_id, rating, title, body, like_count) values ($1, 21, 9, 'Great', $2, 99)", [alice, "x".repeat(60)]),
      ).rejects.toThrow(/row-level security/);
      review = (await rows<{ id: string }>(db, "insert into reviews (user_id, media_id, rating, title, body) values ($1, 21, 9, 'Great', $2) returning id", [alice, "x".repeat(60)]))[0].id;
    });
    await as(db, bob, () => db.query("insert into review_reactions (review_id, user_id) values ($1, $2)", [review, bob]));
    expect((await rows<{ like_count: number }>(db, "select like_count from reviews where id = $1", [review]))[0].like_count).toBe(1);
    const kinds = await as(db, alice, () => rows<{ kind: string }>(db, "select kind from notifications where user_id = $1", [alice]));
    expect(kinds.map((k) => k.kind)).toContain("review_like");
  });

  it("validates review length", async () => {
    await as(db, bob, async () => {
      await expect(db.query("insert into reviews (user_id, media_id, rating, title, body) values ($1, 22, 5, 'Hm', 'short')", [bob])).rejects.toThrow(/check constraint/);
    });
  });

  it("threads comments and notifies the author", async () => {
    await as(db, bob, () => db.query("insert into comments (user_id, target_type, target_id, body) values ($1, 'review', $2, 'Agreed')", [bob, review]));
    expect((await rows<{ comment_count: number }>(db, "select comment_count from reviews where id = $1", [review]))[0].comment_count).toBe(1);
    await as(db, bob, async () => {
      await expect(db.query("insert into comments (user_id, target_type, target_id, body) values ($1, 'review', gen_random_uuid(), 'x')", [bob])).rejects.toThrow(/review not found/);
    });
  });

  it("keeps reports private to reporter and moderators", async () => {
    await as(db, bob, () => db.query("insert into reports (reporter_id, target_type, target_id, reason) values ($1, 'review', $2, 'spam')", [bob, review]));
    await as(db, alice, async () => expect(await rows(db, "select * from reports")).toHaveLength(0));
    await db.query("insert into moderators (user_id) values ($1)", [carol]);
    await as(db, carol, async () => {
      expect(await rows(db, "select * from reports")).toHaveLength(1);
      expect((await db.query("update reviews set status = 'hidden' where id = $1", [review])).affectedRows).toBe(1);
    });
    await as(db, bob, async () => expect(await rows(db, "select * from reviews where id = $1", [review])).toHaveLength(0));
  });
});

describe("watch parties", () => {
  let room: string;
  it("creates the host participant and gates joining by invitation/friendship", async () => {
    room = (await as(db, alice, () => rows<{ id: string }>(db, "insert into watch_party_rooms (host_id, title, series_id, episode_id) values ($1, 'Night', 'open-cinema', '1') returning id", [alice])))[0].id;
    expect(await rows(db, "select role from watch_party_participants where room_id = $1", [room])).toEqual([{ role: "host" }]);
    await as(db, carol, async () => {
      await expect(db.query("insert into watch_party_participants (room_id, user_id) values ($1, $2)", [room, carol])).rejects.toThrow(/row-level security/);
    });
    await as(db, bob, () => db.query("insert into watch_party_participants (room_id, user_id) values ($1, $2)", [room, bob]));
  });

  it("only the host controls playback; the server stamps the clock", async () => {
    await as(db, bob, async () => {
      await expect(db.query("select watch_party_control($1, true, 10)", [room])).rejects.toThrow(/only the host/);
    });
    const [r] = await as(db, alice, () => rows<{ is_playing: boolean; position_seconds: number; state_version: string }>(db, "select * from watch_party_control($1, true, 42.5)", [room]));
    expect(r.is_playing).toBe(true);
    expect(r.position_seconds).toBe(42.5);
    expect(Number(r.state_version)).toBe(1);
  });

  it("blocks guests from promoting themselves to host", async () => {
    await as(db, bob, async () => {
      await expect(db.query("update watch_party_participants set role = 'host' where room_id = $1 and user_id = $2", [room, bob])).rejects.toThrow(/row-level security/);
    });
  });

  it("limits chat to members and invites to friends", async () => {
    await as(db, bob, () => db.query("insert into watch_party_messages (room_id, user_id, body) values ($1, $2, 'hi')", [room, bob]));
    await as(db, carol, async () => {
      expect(await rows(db, "select * from watch_party_messages where room_id = $1", [room])).toHaveLength(0);
    });
    await as(db, alice, async () => {
      await expect(db.query("insert into watch_party_invites (room_id, user_id, invited_by) values ($1, $2, $3)", [room, carol, alice])).rejects.toThrow(/row-level security/);
    });
  });
});

describe("account deletion", () => {
  it("cascades every user-owned row", async () => {
    await db.query("delete from auth.users where id = $1", [alice]);
    for (const t of ["profiles where id", "anime_library_entries where user_id", "library_notes where user_id", "reviews where user_id", "connected_accounts where user_id", "watch_party_rooms where host_id"]) {
      expect(await rows(db, `select 1 from ${t} = $1`, [alice])).toHaveLength(0);
    }
  });
});
