import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// scrypt cost parameters (N = 2^15 uses about 32 MiB of memory per hash)
const N = 2 ** 15;
const R = 8;
const P = 3;
const KEY_LENGTH = 64;

function derive(
  password: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number,
  keyLength: number,
) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyLength,
      { N: n, r, p, maxmem: 128 * n * r * 2 },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

/** Stored as scrypt$N$r$p$salt$hash (base64), so the cost can be raised later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P, KEY_LENGTH);
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  try {
    const [scheme, n, r, p, saltB64, hashB64] = stored.split("$");
    if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;

    const params = [Number(n), Number(r), Number(p)];
    if (params.some((value) => !Number.isInteger(value) || value < 1)) {
      return false;
    }

    const expected = Buffer.from(hashB64, "base64");
    const actual = await derive(
      password,
      Buffer.from(saltB64, "base64"),
      params[0],
      params[1],
      params[2],
      expected.length,
    );
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false; // malformed stored value
  }
}