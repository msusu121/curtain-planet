export const roleLabels: Record<string, string> = { SUPER_ADMIN: 'Super Admin', SALESPERSON: 'Salesperson', POS: 'POS Sales', CUTTING: 'Cutting', TAILOR: 'Tailor', RINGS_PACKAGING: 'Rings & Packaging', STOREKEEPER: 'Storekeeper' };
const menus: Record<string, string[]> = {
  SUPER_ADMIN: ['Overview', 'Orders', 'Catalogue', 'Inventory', 'Customers', 'Production', 'Finance', 'Employees', 'Exceptions', 'Audit', 'Settings'],
  SALESPERSON: ['New Quotation', 'My Quotations', 'Today’s Activity', 'My Customers', 'Collections'],
  POS: ['Sales (POS)', 'Quotations', 'Orders & Payments', 'Today’s Sales', 'Receipts', 'Shift Summary', 'Customers', 'Collections'],
  CUTTING: ['My Orders', 'Completed', 'Collections'],
  TAILOR: ['My Jobs', 'Completed', 'My Earnings', 'Collections'],
  RINGS_PACKAGING: ['My Tasks', 'History', 'Collections'],
  STOREKEEPER: ['To Receive', 'Stored Orders', 'Released Orders', 'History', 'Collections'],
};
export function navigation(role: string): string[] { return menus[role] ?? []; }
export function fixed(value: string, places: number): number {
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${places}})?$`).test(value)) throw new Error(`Enter a non-negative number with at most ${places} decimal places`);
  const [whole, decimal = ''] = value.split('.'); const result = Number(BigInt(whole) * (10n ** BigInt(places)) + BigInt(decimal.padEnd(places, '0')));
  if (!Number.isSafeInteger(result) || result > 1000000000000) throw new Error('Amount is too large');
  return result;
}
export const money = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 2 }).format(n / 100);
export const quantity = (n: number) => new Intl.NumberFormat('en-KE', { maximumFractionDigits: 3 }).format(n / 1000);
export const label = (s: string) => s.toLowerCase().replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
