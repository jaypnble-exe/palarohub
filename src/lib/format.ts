/** Anything with next-intl's number formatter (getFormatter or useFormatter). */
interface NumberFormatter {
  number(value: number, options?: Intl.NumberFormatOptions): string;
}

/** Halalas to "SAR 1,800.00" in the user's formatting. Money is never a float in storage. */
export function formatSar(format: NumberFormatter, halalas: number) {
  return format.number(halalas / 100, { style: "currency", currency: "SAR" });
}
