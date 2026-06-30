import { describe, it, expect, vi, afterEach } from "vitest";
import {
  resolveNotificationIcon,
  formatNotificationTime,
} from "../notificationDisplay";

describe("resolveNotificationIcon", () => {
  it("returns users icon for new_follower", () => {
    expect(resolveNotificationIcon("new_follower")).toBe("users");
  });

  it("returns heart icon for like", () => {
    expect(resolveNotificationIcon("like")).toBe("heart");
  });

  it("returns message icon for comment", () => {
    expect(resolveNotificationIcon("comment")).toBe("message");
  });

  it("returns instagram icon for import_ready", () => {
    expect(resolveNotificationIcon("import_ready")).toBe("instagram");
  });

  it("returns alert-triangle icon for trial_ending", () => {
    expect(resolveNotificationIcon("trial_ending")).toBe("alert-triangle");
  });

  it("returns bell as the default for unknown types", () => {
    expect(resolveNotificationIcon("unknown_type")).toBe("bell");
  });
});

describe("formatNotificationTime", () => {
  const NOW = new Date("2024-06-15T12:00:00Z").getTime();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function freezeNow() {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
  }

  it("returns empty string for an unparseable date", () => {
    freezeNow();
    expect(formatNotificationTime("not-a-date")).toBe("");
  });

  it("returns minutes ago for a diff under one hour", () => {
    freezeNow();
    const createdAt = new Date(NOW - 30 * 60 * 1000).toISOString();
    expect(formatNotificationTime(createdAt)).toBe("30m");
  });

  it("returns at least 1m when the diff is under one minute", () => {
    freezeNow();
    const createdAt = new Date(NOW - 10 * 1000).toISOString();
    expect(formatNotificationTime(createdAt)).toBe("1m");
  });

  it("returns hours ago for a diff between one hour and one day", () => {
    freezeNow();
    const createdAt = new Date(NOW - 3 * 60 * 60 * 1000).toISOString();
    expect(formatNotificationTime(createdAt)).toBe("3h");
  });

  it("returns Yesterday for exactly one day ago", () => {
    freezeNow();
    const createdAt = new Date(NOW - 24 * 60 * 60 * 1000).toISOString();
    expect(formatNotificationTime(createdAt)).toBe("Yesterday");
  });

  it("returns days ago for a diff between two and seven days", () => {
    freezeNow();
    const createdAt = new Date(NOW - 4 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatNotificationTime(createdAt)).toBe("4d");
  });

  it("returns weeks ago for a diff of seven or more days", () => {
    freezeNow();
    const createdAt = new Date(NOW - 14 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatNotificationTime(createdAt)).toBe("2w");
  });
});
