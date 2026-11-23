import type { Staff } from './service.ts';

// This boundary grants no business operations until each domain is implemented.
export type Permission = 'staff:manage' | 'catalogue:manage' | 'receipts:issue';
const grants: Record<Permission, readonly Staff['role'][]> = {
  'staff:manage': ['SUPER_ADMIN'],
  'catalogue:manage': ['SUPER_ADMIN'],
  'receipts:issue': ['POS'],
};
export function hasPermission(user: Staff, permission: Permission): boolean {
  return grants[permission].includes(user.role);
}
export function isAssigned(user: Staff, recipientId: string): boolean {
  return !!recipientId && user.id === recipientId;
}
