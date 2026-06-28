/**
 * Unit tests for AES-256-GCM token encryption/decryption.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encryptToken, decryptToken } from "../../../server/utils/tokenCrypto";

const TEST_KEY = "a".repeat(64); // 64 hex chars = 32 bytes, valid AES-256 key

describe("encryptToken / decryptToken", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("round-trips a plaintext token without data loss", () => {
    const plaintext = "ig-long-lived-access-token-abc123";
    const ciphertext = encryptToken(plaintext);
    const decrypted = decryptToken(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext on each call (random IV)", () => {
    const plaintext = "same-token";
    const first = encryptToken(plaintext);
    const second = encryptToken(plaintext);
    expect(first).not.toBe(second);
    // Both decrypt to the same plaintext.
    expect(decryptToken(first)).toBe(plaintext);
    expect(decryptToken(second)).toBe(plaintext);
  });

  it("encryptToken output has 3 colon-separated parts (iv:authTag:ciphertext)", () => {
    const ciphertext = encryptToken("test");
    const parts = ciphertext.split(":");
    expect(parts).toHaveLength(3);
  });

  it("throws when TOKEN_ENCRYPTION_KEY is absent", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => encryptToken("value")).toThrow();
  });

  it("throws when TOKEN_ENCRYPTION_KEY is the wrong length", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "tooshort";
    expect(() => encryptToken("value")).toThrow();
  });

  it("decryptToken throws on a malformed ciphertext string", () => {
    expect(() => decryptToken("notvalid")).toThrow("Invalid ciphertext format");
  });

  it("decryptToken throws when the auth tag is tampered with", () => {
    const ciphertext = encryptToken("original-token");
    const parts = ciphertext.split(":");
    // Replace the auth tag with garbage.
    parts[1] = "0".repeat(32);
    const tampered = parts.join(":");
    expect(() => decryptToken(tampered)).toThrow();
  });
});
