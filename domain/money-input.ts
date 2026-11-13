export function parseReais(raw: string): number | null {
  const input = raw.trim().replace(/^R\$\s*/i, "");
  if (!input) return raw.trim() ? null : 0;

  const grouped = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(input);
  const normalized = (grouped ? input.replaceAll(".", "") : input).replace(",", ".");
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(normalized)) return null;

  const [reais, cents = ""] = normalized.split(".");
  return Number(reais) * 100 + Number(cents.padEnd(2, "0"));
}
