export function parseReais(raw: string): number | null {
  const input = raw.trim().replace(/^R\$\s*/i, "");
  if (!input) return raw.trim() ? null : 0;

  const grouped = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(input);
  const normalized = (grouped ? input.replaceAll(".", "") : input).replace(",", ".");
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(normalized)) return null;

  const [reais, cents = ""] = normalized.split(".");
  return Number(reais) * 100 + Number(cents.padEnd(2, "0"));
}

export function completePaymentAmounts(total: number, amounts: string[]): string[] {
  const preceding = amounts.slice(0, -1);
  const allocated = preceding.reduce((sum, value) => sum + (parseReais(value) ?? 0), 0);
  return [...preceding, (Math.max(0, total - allocated) / 100).toFixed(2).replace(".", ",")];
}
