import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Spoiler } from "@/components/social/spoiler";
import { RatingInput } from "@/components/social/reviews";
import { useLibrary } from "@/stores/library";
import { useState } from "react";

describe("Spoiler shield", () => {
  it("keeps spoiler content inert until the reader reveals it", async () => {
    render(
      <Spoiler active>
        <p>The twist</p>
      </Spoiler>,
    );
    const hidden = screen.getByText("The twist").parentElement!;
    expect(hidden).toHaveAttribute("aria-hidden", "true");
    await userEvent.click(screen.getByRole("button", { name: /reveal/i }));
    expect(screen.getByText("The twist").parentElement).not.toHaveAttribute("aria-hidden");
  });

  it("renders normally when not a spoiler", () => {
    render(<Spoiler active={false}>visible</Spoiler>);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("RatingInput", () => {
  function Harness() {
    const [v, setV] = useState(0);
    return <RatingInput value={v} onChange={setV} />;
  }
  it("exposes an accessible radio group", async () => {
    render(<Harness />);
    const seven = screen.getByRole("radio", { name: "7 out of 10" });
    await userEvent.click(seven);
    expect(seven).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByRole("radio")).toHaveLength(10);
  });
});

describe("library store", () => {
  beforeEach(() => useLibrary.setState({ entries: {}, collections: {}, remote: null, lastCompleted: null }));
  const media = { id: 5, snapshot: { title: "Frieren", titleNative: null, cover: null, banner: null, color: null, episodes: 28, format: "TV", year: 2023, genres: ["Fantasy"], averageScore: 90, studio: "Madhouse", duration: 24 } };

  it("adds, progresses, completes and signals the celebration", () => {
    useLibrary.getState().upsert(media, { status: "CURRENT" });
    useLibrary.getState().update(5, { progress: 27 });
    expect(useLibrary.getState().entries[5].status).toBe("CURRENT");
    useLibrary.getState().update(5, { progress: 28 });
    expect(useLibrary.getState().entries[5].status).toBe("COMPLETED");
    expect(useLibrary.getState().lastCompleted?.mediaId).toBe(5);
  });

  it("bulk updates and removes", () => {
    useLibrary.getState().upsert(media, {});
    useLibrary.getState().upsert({ ...media, id: 6 }, {});
    useLibrary.getState().bulkUpdate([5, 6], { status: "PAUSED" });
    expect(Object.values(useLibrary.getState().entries).every((e) => e.status === "PAUSED")).toBe(true);
    useLibrary.getState().bulkRemove([5, 6]);
    expect(useLibrary.getState().entries).toEqual({});
  });

  it("manages collections and membership", () => {
    useLibrary.getState().upsert(media, {});
    const c = useLibrary.getState().createCollection({ name: "  Comfy  " });
    expect(c.name).toBe("Comfy");
    useLibrary.getState().toggleInCollection(c.id, 5);
    expect(useLibrary.getState().collections[c.id].mediaIds).toEqual([5]);
    useLibrary.getState().toggleInCollection(c.id, 5);
    expect(useLibrary.getState().collections[c.id].mediaIds).toEqual([]);
  });

  it("does not let an older import clobber newer local edits", () => {
    useLibrary.getState().upsert(media, { progress: 10, status: "CURRENT" });
    const local = useLibrary.getState().entries[5];
    const n = useLibrary.getState().importEntries([{ ...local, progress: 2, updatedAt: local.updatedAt - 1000 }]);
    expect(n).toBe(0);
    expect(useLibrary.getState().entries[5].progress).toBe(10);
  });
});
