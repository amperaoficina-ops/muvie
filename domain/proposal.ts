import { cardQuote, money, paymentMethods, type CardRate, type Product, type StoreId } from "./retail";
import { type ProductColor } from "./product-colors";
import { parseReais } from "./money-input";

export type ProposalProduct = Pick<Product, "id" | "name" | "price" | "stock"> & { colorStock?: Record<string, Partial<Record<ProductColor, number>>> };
export type ProposalItem = { productId: string; quantity: string; color?: string };
export type ProposalPayment = { method: string; amount: string; rateId: string };

export function proposalQuote(products: ProposalProduct[], rates: CardRate[], store: StoreId,
  items: ProposalItem[], payments: ProposalPayment[], discountText: string) {
  const quantities = new Map<string, number>();
  const colorQuantities = new Map<string, number>();
  const lines = items.map(({ productId, quantity, color }) => {
    const product = products.find((entry) => entry.id === productId);
    const units = Number(quantity);
    if (!product || product.price <= 0 || !Number.isSafeInteger(units) || units < 1) return null;
    const count = units + (quantities.get(productId) ?? 0);
    if (count > (product.stock[store] ?? 0)) return null;
    quantities.set(productId, count);
    if (color) {
      const colorKey = productId + ":" + color;
      const availableInColor = product.colorStock?.[store]?.[color as ProductColor] ?? 0;
      const totalInColor = units + (colorQuantities.get(colorKey) ?? 0);
      if (totalInColor > availableInColor) return null;
      colorQuantities.set(colorKey, totalInColor);
    }
    return { name: product.name + (color ? " · " + color : ""), quantity: units, unitPrice: product.price, total: units * product.price };
  });
  if (!lines.length || lines.some((line) => line === null)) return null;
  const subtotal = lines.reduce((sum, line) => sum + line!.total, 0);
  const discount = parseReais(discountText);
  if (discount === null || !Number.isSafeInteger(subtotal) || discount >= subtotal) return null;
  const total = subtotal - discount;
  const conditions = payments.map(({ method, amount, rateId }) => {
    if (!paymentMethods.some((value) => value === method)) return null;
    const value = payments.length === 1 ? total : parseReais(amount);
    if (!value || value > total) return null;
    if (method !== "Cartão") return { method, amount: value, fee: 0, installments: "" };
    const rate = rates.find((entry) => entry.id === rateId);
    if (!rate) return null;
    const quote = cardQuote(value, rate);
    const regular = rate.installments - quote.remainder;
    const installments = `${rate.mode} · ${regular}× de ${money(quote.installment)}` +
      (quote.remainder ? ` + ${quote.remainder}× de ${money(quote.installment + 1)}` : "");
    return { method, amount: value, fee: quote.fee, installments };
  });
  if (conditions.some((line) => line === null) || conditions.reduce((sum, line) => sum + line!.amount, 0) !== total) return null;
  return { lines: lines.filter((line) => line !== null), payments: conditions.filter((line) => line !== null),
    total, subtotal, discount, fees: conditions.reduce((sum, line) => sum + line!.fee, 0) };
}
