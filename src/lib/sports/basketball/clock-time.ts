/** Clock correction fields and audit entries always include tenths of a second. */
export function formatClockTime(ms: number) {
  const tenths = Math.floor(ms / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths % 10}`;
}

export function parseClockTime(value: string): number | null {
  const match = /^(\d{1,2}):([0-5]\d)(?:\.(\d))?$/.exec(value.trim());
  if (!match) return null;
  return (
    Number(match[1]) * 60_000 +
    Number(match[2]) * 1000 +
    Number(match[3] ?? 0) * 100
  );
}
