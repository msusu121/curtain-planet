export function assertCustodyAcceptance(recipient: string, actor: string, expected: number, counted: number): void {
  if (!recipient || recipient !== actor) throw new Error('Designated recipient required');
  if (!Number.isSafeInteger(expected) || expected <= 0 || expected !== counted) throw new Error('Resolve quantity discrepancy before acceptance');
}
export function assertRelease(input: {balanceMinor: number; assignedCollectorId: string; collectorId: string; hasClearance: boolean; expectedPieces: number; countedPieces: number}): void {
  if (input.balanceMinor !== 0 || !input.hasClearance) throw new Error('POS clearance required');
  assertCustodyAcceptance(input.assignedCollectorId, input.collectorId, input.expectedPieces, input.countedPieces);
}
