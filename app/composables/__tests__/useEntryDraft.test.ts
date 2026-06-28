import { describe, it, expect, beforeEach, vi } from "vitest";
import { useEntryDraft } from "~/composables/useEntryDraft";
import type { EntryDraft } from "~/composables/useEntryDraft";

const DRAFT_STORAGE_KEY = "wanderist:new-entry-draft";

const SAMPLE_DRAFT: EntryDraft = {
  title: "Harbor at 4am",
  body: "Cold morning",
  location: "Reykjavík",
  tripId: "trip-1",
  date: "2026-06-14",
  visibility: "private",
  tags: ["iceland"],
  weather: "clear",
  uploadedPhotos: [{ id: "media-1", url: "https://example.com/photo.jpg" }],
};

describe("useEntryDraft", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("saveDraft", () => {
    it("persists the draft to localStorage", () => {
      const { saveDraft } = useEntryDraft();
      saveDraft(SAMPLE_DRAFT);
      const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!)).toEqual(SAMPLE_DRAFT);
    });

    it("overwrites a previously saved draft", () => {
      const { saveDraft } = useEntryDraft();
      saveDraft(SAMPLE_DRAFT);
      const updated = { ...SAMPLE_DRAFT, title: "Updated title" };
      saveDraft(updated);
      const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
      expect(JSON.parse(stored!).title).toBe("Updated title");
    });
  });

  describe("loadDraft", () => {
    it("returns null when no draft is stored", () => {
      const { loadDraft } = useEntryDraft();
      expect(loadDraft()).toBeNull();
    });

    it("returns the stored draft when one exists", () => {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(SAMPLE_DRAFT));
      const { loadDraft } = useEntryDraft();
      expect(loadDraft()).toEqual(SAMPLE_DRAFT);
    });

    it("returns null and removes the key when storage is corrupt", () => {
      localStorage.setItem(DRAFT_STORAGE_KEY, "not-valid-json{{{");
      const { loadDraft } = useEntryDraft();
      const result = loadDraft();
      expect(result).toBeNull();
      expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
    });
  });

  describe("clearDraft", () => {
    it("removes the draft from localStorage", () => {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(SAMPLE_DRAFT));
      const { clearDraft } = useEntryDraft();
      clearDraft();
      expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
    });

    it("does not throw when no draft exists", () => {
      const { clearDraft } = useEntryDraft();
      expect(() => clearDraft()).not.toThrow();
    });
  });
});
