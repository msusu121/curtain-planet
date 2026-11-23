import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const cost = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, cost, (error, key) => error ? reject(error) : resolve(key));
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 128) throw new Error('Password must contain 12–128 characters');
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${(await derive(password, salt)).toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  if (!password || password.length > 128) return false;
  const [algorithm, salt, digest, extra] = encoded.split('$');
  if (algorithm !== 'scrypt' || extra !== undefined || !/^[a-f0-9]{32}$/.test(salt ?? '') || !/^[a-f0-9]{128}$/.test(digest ?? '')) return false;
  return timingSafeEqual(await derive(password, salt), Buffer.from(digest, 'hex'));
}

// Unknown accounts still perform the same expensive password derivation.
export const dummyPasswordHash = `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;
