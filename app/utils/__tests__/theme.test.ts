import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  applyTheme,
  readStoredTheme,
  isValidTheme,
  THEME_STORAGE_KEY,
  THEME_ATTR,
} from "../theme";

describe("isValidTheme", () => {
  it("accepts light", () => {
    expect(isValidTheme("light")).toBe(true);
  });

  it("accepts dark", () => {
    expect(isValidTheme("dark")).toBe(true);
  });

  it("rejects unknown strings", () => {
    expect(isValidTheme("system")).toBe(false);
  });

  it("rejects null", () => {
    expect(isValidTheme(null)).toBe(false);
  });
});

describe("readStoredTheme", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns light when nothing stored", () => {
    expect(readStoredTheme()).toBe("light");
  });

  it("returns stored dark theme", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    expect(readStoredTheme()).toBe("dark");
  });

  it("returns stored light theme", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    expect(readStoredTheme()).toBe("light");
  });

  it("falls back to light for an unrecognized value", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "auto");
    expect(readStoredTheme()).toBe("light");
  });
});

describe("applyTheme", () => {
  let root: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    root = document.createElement("html");
  });

  afterEach(() => {
    root.removeAttribute(THEME_ATTR);
  });

  it("sets the data-theme attribute on the root element", () => {
    applyTheme("dark", root);
    expect(root.getAttribute(THEME_ATTR)).toBe("dark");
  });

  it("persists the theme to localStorage", () => {
    applyTheme("dark", root);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("switches back to light", () => {
    applyTheme("dark", root);
    applyTheme("light", root);
    expect(root.getAttribute(THEME_ATTR)).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });
});
