import crypto from "node:crypto";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.pbkdf2Sync(password, salt, 210000, 32, "sha256").toString("base64url");
  return `pbkdf2_sha256$210000$${salt}$${hash}`;
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  const [algorithm, iterationsText, salt, expectedHash] = passwordHash.split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterationsText || !salt || !expectedHash) return false;
  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations < 100000) return false;
  const actualHash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
  const actual = Buffer.from(actualHash);
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
