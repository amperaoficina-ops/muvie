import type { ScooterSpecs } from "./scooter";

export const stores = [
  { id: "sao-jose", name: "São José", code: "SJ" },
  { id: "palhoca", name: "Palhoça", code: "PH" },
] as const;
export type StoreId = (typeof stores)[number]["id"];
export const acquisitionTypes = ["quitada", "a-pagar", "consignada"] as const;
export type Acquisition = typeof acquisitionTypes[number];
export type Staff = { id: string; name: string; store: StoreId; job: string; salary: number; commissionBps: number; active: boolean };
export type FixedCost = { id: string; name: string; store: StoreId; amount: number; day: number; active: boolean };
export type Asset = { id: string; name: string; store: StoreId; quantity: number; amount: number; notes: string };
export type LedgerEntry = {
  id: string; store: StoreId; name: string; direction: "in" | "out";
  kind: "venda" | "estoque" | "consignacao" | "comissao" | "fixo" | "salario" | "despesa" | "outra-receita" | "ajuste";
  amount: number; date: string; due: string; saleId?: string; canceled?: boolean; manual?: boolean;
  settlements: { id: string; amount: number; date: string; reversedOn?: string }[];
};
export type StockLot = { purchaseId: string; productId: string; store: StoreId; quantity: number; unitCost: number; consigned: boolean; supplier: string; date: string };
export const stages = ["Novo", "Em atendimento", "Proposta", "Ganho", "Perdido"] as const;
export const paymentMethods = ["Pix", "Cartão", "Dinheiro", "Financiamento"] as const;
export const productCategories = ["Scooter elétrica", "Acessório", "Peça"] as const;
export type CardRate = { id: string; name: string; mode: "Débito" | "Crédito"; installments: number; basisPoints: number };
export type AuditEvent = { id: string; actor: string; action: string; at: string };
export type Testimonial = { id: string; author: string; quote: string };
export type Product = {
  id: string; sku: string; name: string; category: typeof productCategories[number];
  description: string; imageUrl: string; price: number; purchaseCost?: number | null; published: boolean;
  stock: Record<StoreId, number>;
  specs?: ScooterSpecs | null;
};
export type Contact = {
  id: string; name: string; phone: string; store: StoreId;
  stage: typeof stages[number]; interest: string; nextContact: string; notes: string;
  email?: string; cpf?: string; birthDate?: string;
  address?: { postalCode: string; street: string; number: string; complement: string; neighborhood: string; city: string; state: string };
  createdAt: string;
};
export type Purchase = {
  id: string; store: StoreId; productId: string; productName: string; sku: string;
  supplier: string; contactId: string; quantity: number; unitCost: number; total: number;
  date: string; invoiceNumber: string; notes: string; createdAt: string;
  acquisition?: Acquisition;
  specs?: ScooterSpecs;
};
export type Sale = {
  id: string; store: StoreId; productId: string; productName: string; sku: string;
  customer: string; contactId: string; quantity: number; unitPrice: number;
  discount: number; total: number; method: typeof paymentMethods[number];
  createdAt: string; canceledAt?: string;
  sellerId?: string; sellerName?: string; commission?: number; cost?: number; missingCostUnits?: number; allocations?: StockLot[]; origin?: string;
};
export type Movement = {
  id: string; store: StoreId; productId: string; productName: string; quantity: number;
  reason: string; createdAt: string; reference?: string;
};
export type RetailState = {
  products: Product[]; contacts: Contact[]; sales: Sale[]; movements: Movement[]; purchases: Purchase[];
  cardRates: CardRate[]; audit: AuditEvent[]; testimonials: Testimonial[];
  staff: Staff[]; fixedCosts: FixedCost[]; assets: Asset[]; ledger: LedgerEntry[]; stockLots: StockLot[];
};
export const emptyRetailState = (): RetailState => ({
  products: [], contacts: [], sales: [], movements: [], purchases: [], cardRates: [], audit: [], testimonials: [],
  staff: [], fixedCosts: [], assets: [], ledger: [], stockLots: [],
});
export const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
export const storeName = (id: StoreId) => stores.find((store) => store.id === id)?.name ?? id;

export class RetailError extends Error {}

export function cardQuote(gross: number, rate: CardRate) {
  const fee = Math.round(gross * rate.basisPoints / 10000);
  const installment = Math.floor(gross / rate.installments);
  return { fee, net: gross - fee, installment, remainder: gross % rate.installments };
}

export function normalizeCpf(input: string) {
  if (!input) return "";
  const cpf = input.replace(/[.\-\s]/g, "");
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) throw new RetailError("Informe um CPF válido.");
  const digit = (length: number) => {
    const sum = [...cpf.slice(0, length)].reduce((total, current, index) => total + Number(current) * (length + 1 - index), 0);
    return ((sum * 10) % 11) % 10;
  };
  if (digit(9) !== Number(cpf[9]) || digit(10) !== Number(cpf[10])) throw new RetailError("Informe um CPF válido.");
  return cpf;
}

export function isCalendarDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

const businessDateFormatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" });
export const businessDate = (date = new Date()) => businessDateFormatter.format(date);
export const settledAmount = (entry: LedgerEntry) => entry.settlements.reduce((total, item) => total + (item.reversedOn ? 0 : item.amount), 0);
export const balanceDue = (entry: LedgerEntry) => entry.canceled ? 0 : entry.amount - settledAmount(entry);

export function settleEntry(state: RetailState, id: string, payment: LedgerEntry["settlements"][number]) {
  const entry = state.ledger.find((item) => item.id === id);
  if (!entry || entry.canceled) throw new RetailError("Compromisso indisponível.");
  if (entry.settlements.some((item) => item.id === payment.id)) return;
  if (!Number.isSafeInteger(payment.amount) || payment.amount <= 0 || payment.amount > balanceDue(entry)) {
    throw new RetailError("Informe um valor maior que zero e dentro do saldo em aberto.");
  }
  if (!isCalendarDate(payment.date) || payment.date < entry.date) throw new RetailError("A baixa deve ser na data do lançamento ou depois.");
  entry.settlements.push(payment);
}

export function reverseSettlement(state: RetailState, entryId: string, paymentId: string, date: string) {
  const entry = state.ledger.find((item) => item.id === entryId && !item.canceled);
  const payment = entry?.settlements.find((item) => item.id === paymentId);
  if (!payment || !entry || (entry.kind === "ajuste" && !entry.manual)) throw new RetailError("Baixa indisponível para estorno.");
  if (!isCalendarDate(date) || date < payment.date) throw new RetailError("Informe uma data igual ou posterior à baixa.");
  payment.reversedOn ??= date;
}

export function postMonthlyCosts(state: RetailState, store: StoreId, month: string) {
  const first = month + "-01";
  if (!isCalendarDate(first)) throw new RetailError("Informe um mês válido.");
  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
  const fixed = state.fixedCosts.filter((item) => item.store === store && item.active).map((item) => ({
    ...item, kind: "fixo" as const,
  }));
  const salaries = state.staff.filter((item) => item.store === store && item.active && item.salary > 0).map((item) => ({
    id: item.id, name: "Salário · " + item.name, amount: item.salary, day: lastDay, kind: "salario" as const,
  }));
  for (const item of [...fixed, ...salaries]) {
    const id = item.kind + "-" + month + "-" + item.id;
    if (state.ledger.some((entry) => entry.id === id)) continue;
    state.ledger.unshift({ id, store, name: item.name, direction: "out", kind: item.kind, amount: item.amount, date: first,
      due: month + "-" + String(Math.min(item.day, lastDay)).padStart(2, "0"), settlements: [] });
  }
}

export function financialReport(state: RetailState, from: string, to: string, store?: StoreId) {
  const includes = (date: string) => date >= from && date <= to;
  const rows = { revenue: 0, cost: 0, commissions: 0, fixed: 0, salary: 0, expenses: 0, other: 0, incoming: 0, outgoing: 0,
    payable: 0, receivable: 0, overdue: 0, missingSales: 0 };
  for (const sale of state.sales) {
    if (store && sale.store !== store) continue;
    const registered = includes(businessDate(new Date(sale.createdAt)));
    const canceled = sale.canceledAt && includes(businessDate(new Date(sale.canceledAt)));
    const sign = Number(registered) - Number(!!canceled);
    if (!sign) continue;
    rows.revenue += sign * sale.total;
    rows.cost += sign * (sale.cost ?? 0);
    rows.commissions += sign * (sale.commission ?? 0);
    if (sale.cost == null || sale.missingCostUnits) rows.missingSales++;
  }
  const today = businessDate();
  for (const entry of state.ledger) {
    if (store && entry.store !== store) continue;
    const balance = balanceDue(entry);
    if (entry.direction === "in") rows.receivable += balance;
    else {
      rows.payable += balance;
      if (entry.due && entry.due < today) rows.overdue += balance;
    }
    if (!entry.canceled && includes(entry.date)) {
      if (entry.kind === "fixo") rows.fixed += entry.amount;
      if (entry.kind === "salario") rows.salary += entry.amount;
      if (entry.kind === "despesa") rows.expenses += entry.amount;
      if (entry.kind === "outra-receita") rows.other += entry.amount;
    }
    for (const payment of entry.settlements) {
      if (includes(payment.date)) rows[entry.direction === "in" ? "incoming" : "outgoing"] += payment.amount;
      if (payment.reversedOn && includes(payment.reversedOn)) rows[entry.direction === "in" ? "outgoing" : "incoming"] += payment.amount;
    }
  }
  return { ...rows, result: rows.revenue + rows.other - rows.cost - rows.commissions - rows.fixed - rows.salary - rows.expenses,
    cash: rows.incoming - rows.outgoing };
}

export function salesRanking(state: RetailState, from: string, to: string, store?: StoreId, sellers = false) {
  const groups = new Map<string, { label: string; units: number; amount: number }>();
  for (const sale of state.sales) {
    if (sale.canceledAt || (store && sale.store !== store)) continue;
    const day = businessDate(new Date(sale.createdAt));
    if (day < from || day > to) continue;
    const key = sellers ? sale.sellerId : sale.productId;
    if (!key) continue;
    const product = sellers ? null : state.products.find((item) => item.id === key);
    if (!sellers && product?.category !== "Scooter elétrica") continue;
    const row = groups.get(key) ?? { label: sellers ? sale.sellerName ?? "Vendedor" : product?.name ?? sale.productName, units: 0, amount: 0 };
    row.units += sale.quantity;
    row.amount += sale.total;
    groups.set(key, row);
  }
  return [...groups.values()].sort((a, b) => b.units - a.units || b.amount - a.amount);
}
function addLot(state: RetailState, lot: StockLot) {
  const current = state.stockLots.find((item) => item.purchaseId === lot.purchaseId && item.store === lot.store);
  if (current) current.quantity += lot.quantity;
  else state.stockLots.push({ ...lot });
}

function takeLots(state: RetailState, productId: string, store: StoreId, units: number, origin?: string) {
  const result: StockLot[] = [];
  const lots = state.stockLots.filter((item) => item.productId === productId && item.store === store && item.quantity > 0 && (!origin || item.purchaseId === origin))
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const lot of lots) {
    const quantity = Math.min(lot.quantity, units);
    if (!quantity) break;
    result.push({ ...lot, quantity });
    lot.quantity -= quantity;
    units -= quantity;
  }
  return { result, untracked: units };
}

function productById(state: RetailState, id: string) {
  const product = state.products.find((item) => item.id === id);
  if (!product) throw new RetailError("Produto não encontrado.");
  return product;
}

export function changeStock(
  state: RetailState, productId: string, store: StoreId, quantity: number,
  reason: string, movementId: string, createdAt: string, reference?: string,
) {
  const product = productById(state, productId);
  const balance = product.stock[store] + quantity;
  if (!Number.isSafeInteger(quantity) || quantity === 0) throw new RetailError("Informe uma quantidade válida.");
  if (!Number.isSafeInteger(balance) || balance < 0) throw new RetailError("Saldo insuficiente nesta unidade.");
  if (quantity < 0 && !reference) takeLots(state, productId, store, -quantity);
  product.stock[store] = balance;
  state.movements.unshift({ id: movementId, store, productId, productName: product.name, quantity, reason, createdAt, reference });
}

export function transferStock(
  state: RetailState, productId: string, from: StoreId, to: StoreId, quantity: number, id: string, date: string,
) {
  if (from === to) throw new RetailError("Selecione unidades diferentes.");
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new RetailError("Informe uma quantidade válida.");
  const product = productById(state, productId);
  if (!Number.isSafeInteger(product.stock[to] + quantity)) throw new RetailError("Saldo de destino acima do limite.");
  changeStock(state, productId, from, -quantity, "Transferência para " + storeName(to), id + "-out", date, id);
  changeStock(state, productId, to, quantity, "Transferência de " + storeName(from), id + "-in", date, id);
  const { result } = takeLots(state, productId, from, quantity);
  for (const lot of result) addLot(state, { ...lot, store: to });
}

type SaleInput = Pick<Sale, "id" | "productId" | "store" | "customer" | "contactId" | "quantity" | "discount" | "method" | "createdAt" | "sellerId" | "origin">
  & { receive?: { mode: "received" | "pending"; due: string } };

type PurchaseInput = Omit<Purchase, "productName" | "sku" | "total"> & { due?: string };

export function recordPurchase(state: RetailState, input: PurchaseInput) {
  if (state.purchases.some((purchase) => purchase.id === input.id)) return;
  const product = productById(state, input.productId);
  const total = input.quantity * input.unitCost;
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0 ||
    !Number.isSafeInteger(input.unitCost) || input.unitCost <= 0 || !Number.isSafeInteger(total)) {
    throw new RetailError("Confira a quantidade e o custo unitário da compra.");
  }
  if (!isCalendarDate(input.date)) throw new RetailError("Informe uma data de compra válida.");
  const contact = input.contactId ? state.contacts.find((item) => item.id === input.contactId) : undefined;
  if (input.contactId && !contact) throw new RetailError("Cliente não encontrado.");
  const supplier = input.supplier || contact?.name;
  if (!supplier) throw new RetailError("Informe o fornecedor ou selecione um cliente vinculado.");
  if (input.acquisition === "a-pagar" && (!input.due || !isCalendarDate(input.due) || input.due < input.date)) {
    throw new RetailError("Informe um vencimento igual ou posterior à compra.");
  }
  changeStock(state, product.id, input.store, input.quantity, "Compra · " + supplier, input.id + "-in", input.createdAt, input.id);
  const { due, ...purchase } = input;
  state.purchases.unshift({ ...purchase, supplier, total, productName: product.name, sku: product.sku });
  addLot(state, { purchaseId: input.id, productId: product.id, store: input.store, quantity: input.quantity,
    unitCost: input.unitCost, consigned: input.acquisition === "consignada", supplier, date: input.date });
  if (input.acquisition && input.acquisition !== "consignada") {
    state.ledger.unshift({
      id: input.id + "-payable", store: input.store, name: "Compra · " + supplier, kind: "estoque", direction: "out",
      amount: total, date: input.date, due: input.acquisition === "a-pagar" ? due! : input.date, settlements: input.acquisition === "quitada"
        ? [{ id: input.id + "-paid", amount: total, date: input.date }] : [],
    });
  }
}

export function recordSale(state: RetailState, input: SaleInput) {
  if (state.sales.some((sale) => sale.id === input.id)) return;
  const product = productById(state, input.productId);
  const gross = product.price * input.quantity;
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0 || !Number.isSafeInteger(gross) || gross <= 0) {
    throw new RetailError("Confira a quantidade e o preço cadastrado no produto.");
  }
  if (!Number.isSafeInteger(input.discount) || input.discount < 0 || input.discount > gross) {
    throw new RetailError("O desconto deve estar entre zero e o valor da venda.");
  }
  const contact = input.contactId ? state.contacts.find((item) => item.id === input.contactId && item.store === input.store) : undefined;
  if (input.contactId && !contact) throw new RetailError("Selecione um contato da mesma unidade da venda.");
  if (!input.customer && !contact) throw new RetailError("Informe o cliente ou selecione um contato do CRM.");
  const seller = input.sellerId ? state.staff.find((item) => item.id === input.sellerId && item.active && item.store === input.store) : undefined;
  if (input.sellerId && !seller) throw new RetailError("Selecione um vendedor ativo da unidade da venda.");
  const date = businessDate(new Date(input.createdAt));
  if (input.receive?.mode === "pending" && (!isCalendarDate(input.receive.due) || input.receive.due < date)) {
    throw new RetailError("Informe um vencimento igual ou posterior à venda.");
  }
  const lots = state.stockLots.filter((lot) => lot.productId === product.id && lot.store === input.store && lot.quantity > 0);
  const legacyUnits = product.stock[input.store] - lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const selectedLot = lots.find((lot) => lot.purchaseId === input.origin);
  if (input.origin === "legacy" && legacyUnits < input.quantity) throw new RetailError("Saldo avulso insuficiente.");
  if (input.origin && input.origin !== "legacy" && (!selectedLot || selectedLot.quantity < input.quantity)) {
    throw new RetailError("O lote selecionado não pertence ao produto e à loja ou tem saldo insuficiente.");
  }
  const hasConsignment = lots.some((lot) => lot.consigned);
  const mixed = legacyUnits > 0 || lots.some((lot) => !lot.consigned) || new Set(lots.map((lot) => lot.supplier)).size > 1;
  if (!input.origin && hasConsignment && mixed) throw new RetailError("Há origens diferentes neste estoque. Selecione o lote ou saldo avulso da venda.");
  changeStock(state, product.id, input.store, -input.quantity, "Venda", input.id + "-out", input.createdAt, input.id);
  const { result: allocations, untracked } = takeLots(state, product.id, input.store, input.quantity, input.origin);
  const total = gross - input.discount;
  const commission = seller ? Number((BigInt(total) * BigInt(seller.commissionBps) + BigInt(5000)) / BigInt(10000)) : 0;
  const { receive, ...sale } = input;
  state.sales.unshift({
    ...sale, customer: contact?.name ?? input.customer, productName: product.name, sku: product.sku,
    unitPrice: product.price, total, sellerName: seller?.name, commission, allocations,
    cost: allocations.reduce((sum, lot) => sum + lot.unitCost * lot.quantity, 0) + untracked * (product.purchaseCost ?? 0),
    missingCostUnits: product.purchaseCost == null ? untracked : 0,
  });
  if (receive && total > 0) state.ledger.unshift({
    id: input.id + "-receipt", saleId: input.id, store: input.store, name: "Venda · " + product.name,
    kind: "venda", direction: "in", amount: total, date, due: receive.mode === "pending" ? receive.due : date,
    settlements: receive.mode === "received" ? [{ id: input.id + "-received", amount: total, date }] : [],
  });
  if (seller && commission > 0) state.ledger.unshift({
    id: input.id + "-commission", saleId: input.id, store: input.store, name: "Comissão · " + seller.name,
    kind: "comissao", direction: "out", amount: commission, date, due: "", settlements: [],
  });
  for (const lot of allocations.filter((item) => item.consigned)) state.ledger.unshift({
    id: input.id + "-" + lot.purchaseId, saleId: input.id, store: input.store, name: "Repasse · " + lot.supplier,
    kind: "consignacao", direction: "out", amount: lot.quantity * lot.unitCost, date, due: "", settlements: [],
  });
  if (contact) contact.stage = "Ganho";
}

export function cancelSale(state: RetailState, id: string, date: string, refundConfirmed = false) {
  const sale = state.sales.find((item) => item.id === id);
  if (!sale) throw new RetailError("Venda não encontrada.");
  if (sale.canceledAt) return;
  const linked = state.ledger.filter((entry) => entry.saleId === id);
  if (linked.some((entry) => entry.direction === "out" && settledAmount(entry))) {
    throw new RetailError("Há comissão ou repasse já pago. Regularize a baixa no Financeiro antes de cancelar.");
  }
  const received = linked.filter((entry) => entry.direction === "in").reduce((sum, entry) => sum + settledAmount(entry), 0);
  if (received && !refundConfirmed) throw new RetailError("Confirme a devolução do valor recebido antes de cancelar.");
  changeStock(state, sale.productId, sale.store, sale.quantity, "Cancelamento de venda", sale.id + "-return", date, sale.id);
  for (const lot of sale.allocations ?? []) addLot(state, lot);
  for (const entry of linked) entry.canceled = true;
  if (received) {
    const day = businessDate(new Date(date));
    state.ledger.unshift({ id: id + "-refund", store: sale.store, name: "Devolução · " + sale.productName, kind: "ajuste",
      direction: "out", amount: received, date: day, due: day, settlements: [{ id: id + "-refunded", amount: received, date: day }] });
  }
  sale.canceledAt = date;
}
