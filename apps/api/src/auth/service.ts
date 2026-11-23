import { createHash, randomBytes } from 'node:crypto';
import { dummyPasswordHash, verifyPassword } from './passwords.ts';

export const roles = ['SUPER_ADMIN', 'SALESPERSON', 'POS', 'CUTTING', 'TAILOR', 'RINGS_PACKAGING', 'STOREKEEPER'] as const;
export type StaffRole = typeof roles[number];
export type Staff = { id: string; name: string; email: string; role: StaffRole };
export type LoginStaff = Staff & { passwordHash: string; active: boolean };
export type Session = { tokenHash: string; userId: string; expiresAt: Date };
export interface AuthStore {
  findByEmail(email: string): Promise<LoginStaff | null>;
  // Recheck account status/password and commit session + audit in one transaction.
  createSession(user: LoginStaff, session: Session): Promise<boolean>;
  findSession(tokenHash: string, now: Date): Promise<Staff | null>;
  revokeSession(tokenHash: string): Promise<void>;
}
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
export function isSessionToken(token: string): boolean {
  return /^[a-f0-9]{64}$/.test(token);
}
export function publicStaff(user: Staff): Staff {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export function createAuthService(store: AuthStore, now: () => Date = () => new Date()) {
  return {
    async login(email: string, password: string) {
      const user = await store.findByEmail(email.trim().toLowerCase());
      const valid = await verifyPassword(password, user?.passwordHash ?? dummyPasswordHash);
      if (!user?.active || !valid) return null;
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(now().getTime() + 12 * 60 * 60 * 1000);
      const committed = await store.createSession(user, { tokenHash: hashToken(token), userId: user.id, expiresAt });
      return committed ? { token, expiresAt, user: publicStaff(user) } : null;
    },
    async authenticate(token: string) {
      if (!isSessionToken(token)) return null;
      const user = await store.findSession(hashToken(token), now());
      return user ? publicStaff(user) : null;
    },
    async logout(token: string) {
      if (isSessionToken(token)) await store.revokeSession(hashToken(token));
    },
  };
}
export type AuthService = ReturnType<typeof createAuthService>;
