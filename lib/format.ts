export function formatMoney(n: number | null | undefined): string {
  const x = Number(n);
  if (!isFinite(x)) return "$0";
  return `$${Math.round(x).toLocaleString()}`;
}

export function monthlyFromWeekly(weekly: number | null | undefined): number {
  const w = Number(weekly || 0);
  return (w * 52) / 12;
}
