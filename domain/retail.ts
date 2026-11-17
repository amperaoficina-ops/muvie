import type { ScooterSpecs } from "./scooter";

export const productColors = [
  "Vermelho", "Laranja", "Amarelo", "Verde", "Azul", "Anil", "Violeta",
  "Branco", "Preto", "Cinza", "Prata", "Marrom", "Bege", "Rosa", "Carbono", "Verde militar",
] as const;

export type ProductColor = typeof productColors[number];

export const stores = [
  { id: "sao-jose", name: "São José", code: "SJ" },
  { id: "palhoca", name: "Palhoça", code: "PH" },
] as const;
export type StoreId = string;
export type Store = { id: StoreId; name: string; code: string };
export const acquisitionTypes = ["quitada", "a-pagar", "consignada"] as const;
export type Acquisition = typeof acquisitionTypes[number];
export type Staff = { id: string; name: string; store: StoreId; job: string; salary: number; commissionBps: number; active: boolean };
export type StaffAdvance = { id: string; staffId: string; store: StoreId; date: string; amount: number; notes: string };
export type FixedCost = { id: string; name: string; store: StoreId; amount: number; day: number; active: boolean };
export type Asset = { acquiredOn?: string; id: string; name: string; store: StoreId; quantity: number; amount: number; notes: string };
export type LedgerEntry = {
  id: string; store: StoreId; name: string; beneficiary?: string; beneficiaryEmail?: string; direction: "in" | "out";
  kind: "venda" | "estoque" | "consignacao" | "comissao" | "fixo" | "salario" | "despesa" | "outra-receita" | "ajuste" | "distribuicao-lucro";
  amount: number; date: string; due: string; saleId?: string; cardFee?: number; nonCash?: boolean; canceled?: boolean; manual?: boolean;
  frequency?: "monthly" | "standalone";
  recurrence?: { months?: number; endedOn?: string; due: string };
  recurringFrom?: string;
  settlements: { id: string; amount: number; date: string; reversedOn?: string }[];
};
export type StockLot = { variantId?: string; color?: ProductColor; purchaseId: string; productId: string; store: StoreId; quantity: number; unitCost: number; consigned: boolean; supplier: string; date: string };
export const stages = ["Novo", "Em atendimento", "Proposta", "Ganho", "Perdido"] as const;
export const stockLotId = (lot: Pick<StockLot, "purchaseId" | "variantId">) => lot.variantId ?? lot.purchaseId;
export const paymentMethods = ["Pix", "Cartão", "Dinheiro", "Financiamento", "Produto"] as const;
export const productCategories = ["Scooter elétrica", "Acessório", "Peça"] as const;
export type TaxRate = { id: string; name: string; basisPoints: number; defaultForSale: boolean };
export type SaleTax = { amount: number; name: string; basisPoints?: number };
export type CardMachine = { id: string; name: string; inactive?: boolean };
export type CardRate = { machineId?: string; id: string; name: string; mode: "Débito" | "Crédito"; installments: number; basisPoints: number };
export const legacyCardMachine = "sem-maquininha";
export const rateMachineId = (rate: CardRate) => rate.machineId ?? legacyCardMachine;
export function cardMachineOptions(machines: CardMachine[], rates: CardRate[]) {
  return rates.some((rate) => !rate.machineId) && !machines.some((machine) => machine.id === legacyCardMachine)
    ? [...machines, { id: legacyCardMachine, name: "Taxas anteriores" }]
    : machines;
}

export const cardMachineIsActive = (machines: CardMachine[], id: string) =>
  (id === legacyCardMachine || machines.some((machine) => machine.id === id)) &&
  !machines.some((machine) => machine.id === id && machine.inactive);

export type AuditEvent = { id: string; actor: string; action: string; at: string };
export type Testimonial = { id: string; author: string; quote: string };
export type Product = {
  colors?: ProductColor[];
  id: string; sku: string; name: string; category: typeof productCategories[number] | "Bicicleta elétrica";
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
export type Supplier = { id: string; name: string; cnpj?: string; location?: string; phone?: string; email?: string; notes?: string };

export type PurchaseLotColor = { color?: ProductColor; quantity: number };

export type Purchase = {
  lotColors?: PurchaseLotColor[];
  color?: ProductColor;
  supplierId?: string;
  canceledAt?: string;
  id: string; store: StoreId; productId: string; productName: string; sku: string;
  supplier: string; contactId: string; quantity: number; unitCost: number; total: number;
  date: string; invoiceNumber: string; notes: string; createdAt: string;
  acquisition?: Acquisition;
  openingBalance?: boolean;
  specs?: ScooterSpecs;
};
export type SaleLine = { color?: ProductColor; productId: string; productName: string; sku: string; quantity: number; unitPrice: number; total: number; cost: number; missingCostUnits: number; gift: boolean };
export type SalePayment = { assetDescription?: string; method: typeof paymentMethods[number]; amount: number; fee: number; rate?: CardRate; due: string; received: boolean };
export type Sale = {
  id: string; store: StoreId; productId: string; productName: string; sku: string;
  customer: string; contactId: string; quantity: number; unitPrice: number;
  discount: number; total: number; method: typeof paymentMethods[number];
  lines?: SaleLine[]; payments?: SalePayment[]; cardFees?: number; tax?: SaleTax;
  createdAt: string; canceledAt?: string; fiscalNotes?: string;
  sellerId?: string; sellerName?: string; commission?: number; cost?: number; missingCostUnits?: number; allocations?: StockLot[]; origin?: string;
};
export type Movement = {
  id: string; store: StoreId; productId: string; productName: string; quantity: number;
  reason: string; createdAt: string; reference?: string;
};
export type RetailState = {
  cashAccounts?: CashAccount[];
  cashAssignments?: CashAssignment[];
  cashReconciliations?: CashReconciliation[];
  suppliers: Supplier[];
  cardMachines: CardMachine[];
  units?: Store[];
  taxRates?: TaxRate[];
  staffAdvances?: StaffAdvance[];
  products: Product[]; contacts: Contact[]; sales: Sale[]; movements: Movement[]; purchases: Purchase[];
  cardRates: CardRate[]; audit: AuditEvent[]; testimonials: Testimonial[];
  staff: Staff[]; fixedCosts: FixedCost[]; assets: Asset[]; ledger: LedgerEntry[]; stockLots: StockLot[];
};
export const emptyRetailState = (): RetailState => ({
  suppliers: [], cardMachines: [], products: [], contacts: [], sales: [], movements: [], purchases: [], cardRates: [], audit: [], testimonials: [],
  staff: [], fixedCosts: [], assets: [], ledger: [], stockLots: [],
});
export const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
export const storeList = (state?: Pick<RetailState, "units">): readonly Store[] => [...stores, ...(state?.units ?? [])];
export const storeName = (id: StoreId, state?: Pick<RetailState, "units">) => storeList(state).find((store) => store.id === id)?.name ?? id;

export function stockComposition(state: RetailState, filter = "", vehiclesOnly = false) {
  const products = state.products.filter((product) => !vehiclesOnly || product.category === "Scooter elétrica" || product.category === "Bicicleta elétrica");
  const ids = new Set(products.map((product) => product.id));
  const lots = state.stockLots.filter((lot) => lot.consigned && lot.quantity > 0 && ids.has(lot.productId) && (!filter || lot.store === filter));
  const total = products.reduce((sum, product) => sum + storeList(state)
    .filter((store) => !filter || store.id === filter)
    .reduce((count, store) => count + (product.stock[store.id] ?? 0), 0), 0);
  const consigned = lots.reduce((sum, lot) => sum + lot.quantity, 0);
  return { lots, total, consigned, owned: total - consigned,
    cost: lots.reduce((sum, lot) => sum + lot.quantity * lot.unitCost, 0) };
}

export class RetailError extends Error {}

export function percentageAmount(base: number, basisPoints: number) {
  return Number((BigInt(base) * BigInt(basisPoints) + BigInt(5000)) / BigInt(10000));
}

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
  if (entry.nonCash && state.ledger.some((item) => item.id === entry.id + "-asset-sale")) throw new RetailError("Este bem já foi vendido.");
  if (!isCalendarDate(date) || date < payment.date) throw new RetailError("Informe uma data igual ou posterior à baixa.");
  payment.reversedOn ??= date;
}

export function isFixedCommitment(entry: LedgerEntry) {
  return entry.kind === "fixo" || entry.kind === "salario" || Boolean(entry.recurrence || entry.recurringFrom);
}

export function materializeCommitments(state: RetailState, asOf: string) {
  const ids = new Set(state.ledger.map((entry) => entry.id));
  for (const template of state.ledger.filter((entry) => entry.recurrence)) {
    const rule = template.recurrence!;
    const [year, month, day] = template.date.split("-").map(Number);
    const [dueYear, dueMonth, dueDay] = rule.due.split("-").map(Number);
    const end = [asOf, rule.endedOn ?? asOf].sort()[0].slice(0, 7);
    for (let offset = 1; offset < (rule.months ?? Infinity); offset++) {
      const date = new Date(Date.UTC(year, month - 1 + offset, 1));
      const period = date.toISOString().slice(0, 7);
      if (period > end) break;
      const id = template.id + "-" + period;
      if (ids.has(id)) continue;
      const clamp = (stamp: Date, desired: number) => {
        const last = new Date(Date.UTC(stamp.getUTCFullYear(), stamp.getUTCMonth() + 1, 0)).getUTCDate();
        return stamp.toISOString().slice(0, 7) + "-" + String(Math.min(desired, last)).padStart(2, "0");
      };
      const due = new Date(Date.UTC(dueYear, dueMonth - 1 + offset, 1));
      state.ledger.push({ id, store: template.store, name: template.name, direction: template.direction, kind: template.kind,
        amount: template.amount, date: clamp(date, day), due: clamp(due, dueDay), settlements: [], manual: true, recurringFrom: template.id });
      ids.add(id);
    }
  }
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

export function tradeInAssets(state: RetailState, store?: StoreId) {
  const entries = new Map(state.ledger.map((entry) => [entry.id, entry]));
  return state.sales.flatMap((sale) => {
    if (sale.canceledAt || (store && sale.store !== store)) return [];
    const payments = sale.payments ?? [{ method: sale.method, amount: sale.total, received: false, assetDescription: undefined }];
    return payments.flatMap((payment, index) => {
      if (payment.method !== "Produto") return [];
      const id = sale.id + (sale.payments ? "-payment-" + index : "-receipt");
      const entry = entries.get(id);
      const resale = entries.get(id + "-asset-sale");
      return [{ id, saleId: sale.id, store: sale.store, name: payment.assetDescription || "Produto recebido na troca",
        amount: payment.amount, received: entry ? (!entry.canceled && balanceDue(entry) === 0) : payment.received,
        customer: sale.customer, createdAt: sale.createdAt, resale }];
    });
  });
}

export function sellTradeInAsset(state: RetailState, assetId: string, amount: number, date: string) {
  const asset = tradeInAssets(state).find((item) => item.id === assetId);
  if (!asset || !asset.received) throw new RetailError("Bem ainda não recebido ou indisponível.");
  if (asset.resale) return;
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new RetailError("Informe um valor de venda maior que zero.");
  const receipt = state.ledger.find((entry) => entry.id === assetId);
  if (!isCalendarDate(date) || date < businessDate(new Date(asset.createdAt)) ||
      receipt?.settlements.some((item) => !item.reversedOn && item.date > date)) {
    throw new RetailError("A data da venda do bem não pode ser anterior ao recebimento.");
  }
  const id = assetId + "-asset-sale";
  state.ledger.unshift({
    id, direction: "in", kind: "ajuste", store: asset.store, name: "Venda de bem · " + asset.name,
    date, due: date, amount, settlements: [{ id: id + "-received", date, amount }],
  });
}

export function saleNetProfit(sale: Sale) {
  if (sale.canceledAt || sale.cost == null || sale.missingCostUnits) return null;
  return sale.total - sale.cost - (sale.cardFees ?? 0) - (sale.tax?.amount ?? 0) - (sale.commission ?? 0);
}

export function ledgerCashEvents(entry: LedgerEntry) {
  if (entry.nonCash) return [];
  const events = entry.settlements.flatMap((payment) => [
    { settlementId: payment.id, reversal: false, date: payment.date, amount: payment.amount },
    ...(payment.reversedOn ? [{ settlementId: payment.id, reversal: true, date: payment.reversedOn, amount: -payment.amount }] : []),
  ]).sort((a, b) => a.date.localeCompare(b.date));
  let gross = 0;
  const net = (value: number) => value - (entry.cardFee && entry.amount ? Math.round(value * entry.cardFee / entry.amount) : 0);
  return events.map((event) => {
    const delta = net(gross + event.amount) - net(gross);
    gross += event.amount;
    return { ...event, amount: entry.direction === "in" ? delta : -delta };
  });
}

export function financialReport(state: RetailState, from: string, to: string, store?: StoreId) {
  const includes = (date: string) => date >= from && date <= to;
  const rows = { revenue: 0, cost: 0, commissions: 0, cardFees: 0, taxes: 0, fixed: 0, salary: 0, expenses: 0, other: 0, distributions: 0, incoming: 0, outgoing: 0, purchaseOutflow: 0,
    payable: 0, receivable: 0, overdue: 0, missingSales: 0 };
  for (const sale of state.sales) {
    if (store && sale.store !== store) continue;
    const registered = includes(businessDate(new Date(sale.createdAt)));
    const canceled = sale.canceledAt && includes(businessDate(new Date(sale.canceledAt)));
    const sign = Number(registered) - Number(!!canceled);
    if (!sign) continue;
    rows.revenue += sign * sale.total;
    rows.cost += sign * (sale.cost ?? 0);
    rows.taxes += sign * (sale.tax?.amount ?? 0);
    rows.cardFees += sign * (sale.cardFees ?? 0);
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
      if (entry.kind === "distribuicao-lucro") rows.distributions += entry.amount;
      if (entry.kind === "outra-receita") rows.other += entry.amount;
    }
    for (const event of ledgerCashEvents(entry)) {
      if (!includes(event.date)) continue;
      rows[event.amount >= 0 ? "incoming" : "outgoing"] += Math.abs(event.amount);
      if (entry.kind === "estoque" && event.amount < 0) rows.purchaseOutflow -= event.amount;
    }
  }
  return { ...rows, result: rows.revenue + rows.other - rows.cost - rows.commissions - rows.cardFees - rows.taxes - rows.fixed - rows.salary - rows.expenses,
    cash: rows.incoming - rows.outgoing };
}

export function recordProfitDistribution(state: RetailState, input: {
  id: string; store: StoreId; beneficiary: string; beneficiaryEmail?: string; amount: number; date: string;
}) {
  if (state.ledger.some((item) => item.id === input.id)) return;
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || !input.beneficiary.trim() || !isCalendarDate(input.date)) {
    throw new RetailError("Informe o beneficiário, a data e um valor positivo.");
  }
  state.ledger.unshift({
    ...input, name: "Distribuição de lucro · " + input.beneficiary, kind: "distribuicao-lucro", direction: "out", due: input.date,
    settlements: [{ id: input.id + "-paid", amount: input.amount, date: input.date }],
  });
}

export function overviewAnalytics(state: RetailState, from: string, to: string, store?: StoreId) {
  const selected = (id: StoreId) => !store || id === store;
  const inPeriod = (date: string) => date >= from && date <= to;
  const sales = state.sales.filter((sale) => selected(sale.store) && !sale.canceledAt && inPeriod(businessDate(new Date(sale.createdAt))));
  const purchases = state.purchases.filter((purchase) => selected(purchase.store) && !purchase.canceledAt && inPeriod(purchase.date));
  const contacts = state.contacts.filter((contact) => selected(contact.store));
  const units = storeList(state).filter((unit) => selected(unit.id));
  const lots = state.stockLots.filter((lot) => selected(lot.store) && lot.quantity > 0);
  const movements = state.movements.filter((movement) => selected(movement.store) && inPeriod(businessDate(new Date(movement.createdAt))));
  const total = sales.reduce((sum, sale) => sum + sale.total, 0);
  const ledger = state.ledger.filter((entry) => selected(entry.store) && !entry.canceled);
  const purchasesByStatus = { Quitadas: 0, "A pagar": 0, Consignadas: 0, "Sem classificação": 0 };
  const ledgerById = new Map(ledger.map((entry) => [entry.id, entry]));
  for (const purchase of purchases) {
    const payable = ledgerById.get(purchase.id + "-payable");
    const status = purchase.acquisition === "consignada" ? "Consignadas" :
      payable && balanceDue(payable) > 0 ? "A pagar" :
      payable || purchase.acquisition === "quitada" ? "Quitadas" : "Sem classificação";
    purchasesByStatus[status] += purchase.total;
  }
  const stockByCategory = new Map<string, number>();
  for (const product of state.products) {
    const quantity = units.reduce((sum, unit) => sum + (product.stock[unit.id] ?? 0), 0);
    stockByCategory.set(product.category, (stockByCategory.get(product.category) ?? 0) + quantity);
  }
  const day = 86400000;
  const start = Date.parse(from + "T00:00:00Z");
  const end = Date.parse(to + "T00:00:00Z");
  const step = Math.max(1, Math.ceil(((end - start) / day + 1) / 10)) * day;
  const buckets: { start: string; end: string; revenue: number; sales: number }[] = [];
  for (let date = start; date <= end; date += step) {
    buckets.push({ start: new Date(date).toISOString().slice(0, 10),
      end: new Date(Math.min(end, date + step - day)).toISOString().slice(0, 10), revenue: 0, sales: 0 });
  }
  for (const sale of sales) {
    const date = businessDate(new Date(sale.createdAt));
    const index = Math.floor((Date.parse(date + "T00:00:00Z") - start) / step);
    const bucket = buckets[index];
    if (bucket) { bucket.revenue += sale.total; bucket.sales++; }
  }
  return {
    sales, total, average: sales.length ? Math.round(total / sales.length) : 0, buckets,
    purchases, purchasesByStatus, stockByCategory: [...stockByCategory], contacts,
    salesByMethod: paymentMethods.map((method) => [method, sales.reduce((sum, sale) => sum +
      (sale.payments ?? [{ method: sale.method, amount: sale.total }]).reduce((amount, payment) => amount + (payment.method === method ? payment.amount : 0), 0), 0)] as const),
    salesByStore: units.map((unit) => [unit.name, sales.reduce((sum, sale) => sum + (sale.store === unit.id ? sale.total : 0), 0)] as const),
    stockByColor: productColors.map((color) => [color, lots.reduce((sum, lot) => sum + (lot.color === color ? lot.quantity : 0), 0)] as const),
    movementTotals: { Entradas: movements.reduce((sum, item) => sum + Math.max(0, item.quantity), 0),
      Saídas: movements.reduce((sum, item) => sum + Math.max(0, -item.quantity), 0) },
    advances: (state.staffAdvances ?? []).filter((item) => selected(item.store) && inPeriod(item.date)),
    activeStaff: state.staff.filter((item) => selected(item.store) && item.active).length,
    assets: state.assets.filter((item) => selected(item.store)),
    tradeIns: tradeInAssets(state, store),
  };
}

export function salesRanking(state: RetailState, from: string, to: string, store?: StoreId, sellers = false) {
  const groups = new Map<string, { label: string; units: number; amount: number }>();
  for (const sale of state.sales) {
    if (sale.canceledAt || (store && sale.store !== store)) continue;
    const day = businessDate(new Date(sale.createdAt));
    if (day < from || day > to) continue;
    const lines = sellers
      ? [{ productId: sale.sellerId, productName: sale.sellerName ?? "Vendedor", quantity: (sale.lines ?? [sale]).reduce((sum, line) => sum + ("gift" in line && line.gift ? 0 : line.quantity), 0), total: sale.total }]
      : (sale.lines ?? [sale]).filter((line) => !("gift" in line && line.gift));
    for (const line of lines) {
      const key = line.productId;
      if (!key) continue;
      const product = sellers ? null : state.products.find((item) => item.id === key);
      if (!sellers && product?.category !== "Scooter elétrica" && product?.category !== "Bicicleta elétrica") continue;
      const row = groups.get(key) ?? { label: line.productName, units: 0, amount: 0 };
      row.units += line.quantity;
      row.amount += line.total;
      groups.set(key, row);
    }
  }
  return [...groups.values()].sort((a, b) => b.units - a.units || b.amount - a.amount);
}
export function modelMarginRanking(state: RetailState, from: string, to: string, store?: StoreId) {
  const margins = new Map<string, { label: string; margin: number }>();
  for (const sale of state.sales) {
    const date = businessDate(new Date(sale.createdAt));
    if (sale.canceledAt || sale.cost == null || sale.missingCostUnits || date < from || date > to || (store && sale.store !== store)) continue;
    const lines = sale.lines ?? [{ ...sale, cost: sale.cost, gift: false }];
    const giftCost = lines.reduce((sum, line) => sum + (line.gift ? line.cost : 0), 0);
    const sharedCost = giftCost + (sale.tax?.amount ?? 0) + (sale.cardFees ?? 0) + (sale.commission ?? 0);
    let revenue = 0;
    let allocated = 0;
    let first = true;
    for (const line of lines) {
      if (line.gift) continue;
      revenue += line.total;
      const cumulative = sale.total ? Math.round(revenue / sale.total * sharedCost) : sharedCost;
      const share = sale.total || first ? cumulative - allocated : 0;
      first = false;
      allocated = cumulative;
      const product = state.products.find((item) => item.id === line.productId);
      if (product?.category !== "Scooter elétrica" && product?.category !== "Bicicleta elétrica") continue;
      const row = margins.get(line.productId) ?? { label: line.productName, margin: 0 };
      row.margin += line.total - line.cost - share;
      margins.set(line.productId, row);
    }
  }
  return [...margins.values()].sort((a, b) => b.margin - a.margin);
}

function addLot(state: RetailState, lot: StockLot) {
  const current = state.stockLots.find((item) => stockLotId(item) === stockLotId(lot) && item.store === lot.store);
  if (current) current.quantity += lot.quantity;
  else state.stockLots.push({ ...lot });
}

function takeLots(state: RetailState, productId: string, store: StoreId, units: number, origin?: string) {
  const result: StockLot[] = [];
  const lots = state.stockLots.filter((item) => item.productId === productId && item.store === store && item.quantity > 0 && (!origin || stockLotId(item) === origin))
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
  const balance = (product.stock[store] ?? 0) + quantity;
  if (!Number.isSafeInteger(quantity) || quantity === 0) throw new RetailError("Informe uma quantidade válida.");
  if (!Number.isSafeInteger(balance) || balance < 0) throw new RetailError("Saldo insuficiente nesta unidade.");
  if (quantity < 0 && !reference) takeLots(state, productId, store, -quantity);
  product.stock[store] = balance;
  state.movements.unshift({ id: movementId, store, productId, productName: product.name, quantity, reason, createdAt, reference });
}

export function returnConsignedLot(state: RetailState, input: {
  id: string; purchaseId: string; productId: string; store: StoreId; quantity: number; createdAt: string;
}) {
  if (state.movements.some((entry) => entry.id === input.id)) return;
  const lot = state.stockLots.find((item) => stockLotId(item) === input.purchaseId && item.productId === input.productId &&
    item.store === input.store && item.consigned);
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || !lot || input.quantity > lot.quantity) {
    throw new RetailError("Informe uma quantidade dentro do saldo consignado deste lote.");
  }
  changeStock(state, lot.productId, lot.store, -input.quantity, "Devolução de consignado · " + lot.supplier,
    input.id, input.createdAt, lot.purchaseId);
  lot.quantity -= input.quantity;
}

export function classifyLegacyConsignment(state: RetailState, lot: StockLot) {
  const product = productById(state, lot.productId);
  const tracked = state.stockLots.filter((item) => item.productId === lot.productId && item.store === lot.store)
    .reduce((sum, item) => sum + item.quantity, 0);
  const available = (product.stock[lot.store] ?? 0) - tracked;
  if (!Number.isSafeInteger(lot.quantity) || lot.quantity <= 0 || lot.quantity > available) {
    throw new RetailError("A quantidade supera o saldo avulso desta unidade. Confira os lotes já registrados.");
  }
  if (!Number.isSafeInteger(lot.unitCost * lot.quantity) || lot.unitCost <= 0) throw new RetailError("Informe o custo de repasse.");
  addLot(state, lot);
}

export function stockLotForMovement(state: RetailState, productId: string, store: StoreId, purchaseId: string, quantity: number) {
  const lot = state.stockLots.find((item) => item.productId === productId && item.store === store && stockLotId(item) === purchaseId);
  if (!lot || lot.quantity < quantity) throw new RetailError("O lote selecionado não tem saldo suficiente nesta unidade.");
  return lot;
}

export function transferStock(
  state: RetailState, productId: string, from: StoreId, to: StoreId, quantity: number, id: string, date: string, origin?: string,
) {
  if (from === to) throw new RetailError("Selecione unidades diferentes.");
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new RetailError("Informe uma quantidade válida.");
  const product = productById(state, productId);
  if (origin) stockLotForMovement(state, productId, from, origin, quantity);
  if (!Number.isSafeInteger((product.stock[to] ?? 0) + quantity)) throw new RetailError("Saldo de destino acima do limite.");
  changeStock(state, productId, from, -quantity, "Transferência para " + storeName(to, state), id + "-out", date, id);
  changeStock(state, productId, to, quantity, "Transferência de " + storeName(from, state), id + "-in", date, id);
  const { result } = takeLots(state, productId, from, quantity, origin);
  for (const lot of result) addLot(state, { ...lot, store: to });
}

type SaleInput = Pick<Sale, "id" | "productId" | "store" | "customer" | "contactId" | "quantity" | "discount" | "method" | "createdAt" | "sellerId" | "origin">
  & { receive?: { mode: "received" | "pending"; due: string } };

export function saveSupplierRecord(state: RetailState, supplier: Supplier, editing = false) {
  const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ").normalize("NFD")
    .replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
  const name = supplier.name.trim().replace(/\s+/g, " ");
  if (!name) throw new RetailError("Informe o nome do fornecedor.");
  const existing = state.suppliers.find((item) => item.id !== supplier.id && normalizeName(item.name) === normalizeName(name));
  if (existing) {
    if (editing) throw new RetailError("Já existe um fornecedor com este nome.");
    return existing;
  }
  const current = state.suppliers.find((item) => item.id === supplier.id);
  if (editing && !current) throw new RetailError("Fornecedor não encontrado.");
  const record = { ...supplier, name };
  if (current) Object.assign(current, record);
  else state.suppliers.push(record);
  return record;
}

type PurchaseInput = Omit<Purchase, "productName" | "sku" | "total"> & { due?: string };

function validatePurchaseLotColors(quantity: number, rows: PurchaseLotColor[]) {
  const colors = new Set(rows.map((row) => row.color ?? ""));
  if (!rows.length || rows.length > 17 || colors.size !== rows.length ||
      rows.some((row) => !Number.isSafeInteger(row.quantity) || row.quantity <= 0) ||
      rows.reduce((sum, row) => sum + row.quantity, 0) !== quantity) {
    throw new RetailError("Use uma linha por cor e confira se as quantidades somam o total da compra.");
  }
}

function purchaseColorLots(base: Omit<StockLot, "quantity" | "color" | "variantId">, rows: PurchaseLotColor[]) {
  return rows.map((row, index) => ({ ...base, ...row,
    ...(rows.length > 1 ? { variantId: base.purchaseId + ":cor:" + (index + 1) } : {}) }));
}

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
  if (input.openingBalance && input.acquisition === "a-pagar") {
    throw new RetailError("Para vincular saldo anterior, selecione compra quitada ou consignada.");
  }
  if (input.acquisition === "a-pagar" && (!input.due || !isCalendarDate(input.due) || input.due < input.date)) {
    throw new RetailError("Informe um vencimento igual ou posterior à compra.");
  }
  const rows = input.lotColors ?? [{ quantity: input.quantity, color: input.color }];
  validatePurchaseLotColors(input.quantity, rows);
  const lots = purchaseColorLots({ purchaseId: input.id, productId: product.id, store: input.store,
    unitCost: input.unitCost, consigned: input.acquisition === "consignada", supplier, date: input.date }, rows);
  if (input.openingBalance) {
    const tracked = state.stockLots.filter((lot) => lot.productId === product.id && lot.store === input.store)
      .reduce((sum, lot) => sum + lot.quantity, 0);
    if (input.quantity > (product.stock[input.store] ?? 0) - tracked) {
      throw new RetailError("A quantidade supera o saldo avulso desta unidade.");
    }
  } else {
    changeStock(state, product.id, input.store, input.quantity, "Compra · " + supplier, input.id + "-in", input.createdAt, input.id);
  }
  for (const lot of lots) addLot(state, lot);
  const { due, ...purchase } = input;
  state.purchases.unshift({ ...purchase, supplier, total, productName: product.name, sku: product.sku,
    color: rows.length === 1 ? rows[0].color : undefined });
  if (!input.openingBalance && input.acquisition && input.acquisition !== "consignada") {
    state.ledger.unshift({
      id: input.id + "-payable", store: input.store, name: "Compra · " + supplier, kind: "estoque", direction: "out",
      amount: total, date: input.date, due: input.acquisition === "a-pagar" ? due! : input.date, settlements: input.acquisition === "quitada"
        ? [{ id: input.id + "-paid", amount: total, date: input.date }] : [],
    });
  }
}

export function recordSale(state: RetailState, input: SaleInput, gift = false) {
  if (state.sales.some((sale) => sale.id === input.id)) return;
  const product = productById(state, input.productId);
  const gross = product.price * input.quantity;
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0 || !Number.isSafeInteger(gross) || (gift ? gross < 0 : gross <= 0)) {
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
  const legacyUnits = (product.stock[input.store] ?? 0) - lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const selectedLot = lots.find((lot) => stockLotId(lot) === input.origin);
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
    kind: "venda", direction: "in", amount: total, nonCash: input.method === "Produto" || undefined, date, due: receive.mode === "pending" ? receive.due : date,
    settlements: receive.mode === "received" ? [{ id: input.id + "-received", amount: total, date }] : [],
  });
  if (seller && commission > 0) state.ledger.unshift({
    id: input.id + "-commission", saleId: input.id, store: input.store, name: "Comissão · " + seller.name,
    kind: "comissao", direction: "out", amount: commission, date, due: "", settlements: [],
  });
  for (const lot of allocations.filter((item) => item.consigned)) state.ledger.unshift({
    id: input.id + "-" + stockLotId(lot), saleId: input.id, store: input.store, name: "Repasse · " + lot.supplier,
    kind: "consignacao", direction: "out", amount: lot.quantity * lot.unitCost, date, due: "", settlements: [],
  });
  if (contact) contact.stage = "Ganho";
}

export type CheckoutItem = { productId: string; quantity: number; origin: string; gift: boolean; unitCostOverride?: number };
export type CheckoutPayment = { assetDescription?: string; method: SalePayment["method"]; amount: number; received: boolean; due: string; rateId?: string };
export type CheckoutInput = Omit<SaleInput, "productId" | "quantity" | "method" | "origin" | "receive"> & {
  items: CheckoutItem[]; payments: CheckoutPayment[]; taxRateId?: string; manualTax?: number;
};

export function recordCheckout(state: RetailState, input: CheckoutInput) {
  if (state.sales.some((sale) => sale.id === input.id)) return;
  if (!input.items.length || !input.items.some((item) => !item.gift) || input.items.length > 20 || input.payments.length > 12) {
    throw new RetailError("Adicione ao menos um item de venda e confira os limites do formulário.");
  }
  const draft = structuredClone(state);
  const date = businessDate(new Date(input.createdAt));
  const gross = input.items.reduce((sum, item) => sum + (item.gift ? 0 : productById(draft, item.productId).price * item.quantity), 0);
  if (!Number.isSafeInteger(gross) || !Number.isSafeInteger(input.discount) || input.discount < 0 || input.discount > gross) {
    throw new RetailError("Confira o total dos itens e o desconto.");
  }
  const total = gross - input.discount;
  const taxRates = state.taxRates ?? [];
  const rate = input.taxRateId ? taxRates.find((item) => item.id === input.taxRateId) : taxRates.find((item) => item.defaultForSale);
  if (input.manualTax === undefined && input.taxRateId && !rate) throw new RetailError("Imposto selecionado não encontrado.");
  if (input.manualTax !== undefined && (!Number.isSafeInteger(input.manualTax) || input.manualTax < 0 || input.manualTax > total)) {
    throw new RetailError("Informe um imposto entre zero e o total da venda.");
  }
  const tax = input.manualTax !== undefined ? { name: "Imposto manual", amount: input.manualTax }
    : rate ? { name: rate.name, basisPoints: rate.basisPoints, amount: percentageAmount(total, rate.basisPoints) } : undefined;
  const payments: SalePayment[] = input.payments.map((payment) => {
    if (!Number.isSafeInteger(payment.amount) || payment.amount <= 0) throw new RetailError("Informe um valor positivo para cada pagamento.");
    if (!payment.received && (!isCalendarDate(payment.due) || payment.due < date)) throw new RetailError("Informe o vencimento dos pagamentos a receber.");
    const rate = payment.method === "Cartão" ? draft.cardRates.find((item) => item.id === payment.rateId) : undefined;
    if (payment.method === "Cartão" && !rate) throw new RetailError("Selecione a taxa da maquininha para cada pagamento em cartão.");
    return { ...(payment.method === "Produto" && payment.assetDescription?.trim() && { assetDescription: payment.assetDescription.trim() }), method: payment.method, amount: payment.amount, fee: rate ? cardQuote(payment.amount, rate).fee : 0,
      rate, received: payment.received, due: payment.received ? date : payment.due };
  });
  if (payments.reduce((sum, payment) => sum + payment.amount, 0) !== total) throw new RetailError("A soma dos pagamentos deve ser igual ao total da venda.");
  let priced = 0;
  let allocatedDiscount = 0;
  const snapshots = input.items.map((item, index) => {
    const product = productById(draft, item.productId);
    if (!item.origin || item.origin === "legacy") throw new RetailError("Selecione o lote de compra de cada item. Regularize saldos antigos em Compras.");
    const lineGross = product.price * item.quantity;
    if (!item.gift) priced += lineGross;
    const share = gross ? Math.round(priced / gross * input.discount) : 0;
    const discount = item.gift ? lineGross : share - allocatedDiscount;
    allocatedDiscount = share;
    const id = input.id + "-item-" + index;
    recordSale(draft, { id, store: input.store, customer: input.customer, contactId: input.contactId,
      sellerId: input.sellerId, createdAt: input.createdAt, productId: item.productId, quantity: item.quantity,
      origin: item.origin, discount, method: payments[0]?.method ?? "Pix" }, item.gift);
    const sale = draft.sales.shift()!;
    if (item.unitCostOverride !== undefined) {
      const cost = item.unitCostOverride * item.quantity;
      if (!Number.isSafeInteger(cost) || cost < 0) throw new RetailError("Confira o custo unitário informado.");
      sale.cost = cost;
      sale.missingCostUnits = 0;
    }
    return { sale, gift: item.gift };
  });
  const first = snapshots.find((row) => !row.gift)!.sale;
  const lines = snapshots.map(({ sale, gift }) => ({
    productId: sale.productId, productName: sale.productName, sku: sale.sku, quantity: sale.quantity,
    color: sale.allocations?.[0]?.color, unitPrice: gift ? 0 : sale.unitPrice, total: sale.total, cost: sale.cost ?? 0, missingCostUnits: sale.missingCostUnits ?? 0, gift,
  }));
  const sum = (key: "cost" | "missingCostUnits" | "commission") => snapshots.reduce((value, row) => value + (row.sale[key] ?? 0), 0);
  const seller = draft.staff.find((item) => item.id === input.sellerId);
  const commission = seller ? Number((BigInt(total) * BigInt(seller.commissionBps) + BigInt(5000)) / BigInt(10000)) : 0;
  const prefix = input.id + "-item-";
  draft.ledger = draft.ledger.filter((entry) => !entry.saleId?.startsWith(prefix) || entry.kind !== "comissao");
  for (const entry of draft.ledger) if (entry.saleId?.startsWith(prefix)) entry.saleId = input.id;
  for (const movement of draft.movements) if (movement.reference?.startsWith(prefix)) movement.reference = input.id;
  if (commission) draft.ledger.unshift({
    id: input.id + "-commission", saleId: input.id, store: input.store, name: "Comissão · " + first.sellerName,
    kind: "comissao", direction: "out", amount: commission, date, due: "", settlements: [],
  });
  for (const [index, payment] of payments.entries()) {
    const id = input.id + "-payment-" + index;
    draft.ledger.unshift({ id, saleId: input.id, store: input.store, kind: "venda", direction: "in",
      name: "Venda · " + payment.method + (payment.fee ? " · taxa " + money(payment.fee) : ""),
      amount: payment.amount, cardFee: payment.fee, nonCash: payment.method === "Produto" || undefined, date, due: payment.due,
      settlements: payment.received ? [{ id: id + "-received", amount: payment.amount, date }] : [] });
  }
  draft.sales.unshift({ ...first, id: input.id, total, discount: input.discount, commission, lines, payments, tax,
    cardFees: payments.reduce((sum, payment) => sum + payment.fee, 0), cost: sum("cost"), missingCostUnits: sum("missingCostUnits"),
    allocations: snapshots.flatMap(({ sale }) => sale.allocations ?? []) });
  Object.assign(state, draft);
}

export function cancelPurchase(state: RetailState, id: string, canceledAt: string, paymentReversed = false) {
  const purchase = state.purchases.find((item) => item.id === id);
  if (!purchase) throw new RetailError("Compra não encontrada.");
  if (purchase.canceledAt) return;
  const lots = state.stockLots.filter((lot) => lot.purchaseId === id && lot.productId === purchase.productId && lot.quantity > 0);
  if (lots.reduce((sum, lot) => sum + lot.quantity, 0) !== purchase.quantity) {
    throw new RetailError("O saldo do lote está incompleto. Confira as vendas e saídas antes de cancelar a compra.");
  }
  const product = productById(state, purchase.productId);
  const quantities = new Map<StoreId, number>();
  for (const lot of lots) quantities.set(lot.store, (quantities.get(lot.store) ?? 0) + lot.quantity);
  if (!purchase.openingBalance && [...quantities].some(([store, quantity]) => (product.stock[store] ?? 0) < quantity)) {
    throw new RetailError("O saldo da unidade é insuficiente para cancelar a compra.");
  }
  const payable = state.ledger.find((entry) => entry.id === id + "-payable");
  const payments = payable?.settlements.filter((item) => !item.reversedOn) ?? [];
  const date = businessDate(new Date(canceledAt));
  if (payments.length && !paymentReversed) {
    throw new RetailError("Confirme que os pagamentos da compra foram devolvidos ou lançados por engano.");
  }
  if (payments.some((item) => item.date > date)) throw new RetailError("Há uma baixa com data posterior ao cancelamento.");

  if (!purchase.openingBalance) for (const [store, quantity] of quantities) {
    changeStock(state, purchase.productId, store, -quantity, "Cancelamento de compra · " + purchase.supplier,
      id + "-cancel-" + store, canceledAt, id);
  }
  for (const lot of lots) lot.quantity = 0;
  for (const payment of payments) payment.reversedOn = date;
  if (payable) payable.canceled = true;
  purchase.canceledAt = canceledAt;
}

export function setPurchaseLotColors(state: RetailState, id: string, rows: PurchaseLotColor[]) {
  const purchase = state.purchases.find((item) => item.id === id && !item.canceledAt);
  if (!purchase) throw new RetailError("Compra ativa não encontrada.");
  validatePurchaseLotColors(purchase.quantity, rows);
  const lots = state.stockLots.filter((lot) => lot.purchaseId === id && lot.quantity > 0);
  const previouslySold = state.sales.some((sale) => sale.allocations?.some((lot) => lot.purchaseId === id));
  if (previouslySold || lots.some((lot) => lot.store !== purchase.store) ||
      lots.reduce((sum, lot) => sum + lot.quantity, 0) !== purchase.quantity) {
    throw new RetailError("Para redistribuir as cores, todas as unidades do lote devem estar na loja de origem e sem histórico de venda.");
  }
  state.stockLots = state.stockLots.filter((lot) => lot.purchaseId !== id);
  for (const lot of purchaseColorLots({ purchaseId: id, productId: purchase.productId, store: purchase.store,
    unitCost: purchase.unitCost, consigned: purchase.acquisition === "consignada", supplier: purchase.supplier, date: purchase.date }, rows)) addLot(state, lot);
  purchase.color = rows.length === 1 ? rows[0].color : undefined;
  purchase.lotColors = rows;
}

export function productColorStock(lots: StockLot[]) {
  const stock: Record<string, Record<StoreId, Partial<Record<ProductColor, number>>>> = {};
  for (const lot of lots) {
    if (!lot.color || lot.quantity <= 0) continue;
    const colors = ((stock[lot.productId] ??= {})[lot.store] ??= {});
    colors[lot.color] = (colors[lot.color] ?? 0) + lot.quantity;
  }
  return stock;
}

export function productColorAvailability(product: Product, lots: StockLot[]) {
  const available = new Set(lots.filter((lot) => lot.productId === product.id && lot.color && lot.quantity > 0).map((lot) => lot.color));
  return productColors.map((color) => ({ color, available: available.has(color) }));
}

export function updatePurchaseCost(state: RetailState, id: string, unitCost: number) {
  const purchase = state.purchases.find((item) => item.id === id);
  if (!purchase || purchase.canceledAt) throw new RetailError("Compra ativa não encontrada.");
  const total = unitCost * purchase.quantity;
  if (!Number.isSafeInteger(total) || unitCost <= 0) throw new RetailError("Informe um custo unitário positivo.");
  if (unitCost === purchase.unitCost) return;
  const payable = state.ledger.find((entry) => entry.id === id + "-payable");
  if (payable && settledAmount(payable) > total) throw new RetailError("O novo total é menor que as baixas da compra. Ajuste as baixas no Financeiro primeiro.");
  if (payable) payable.amount = total;
  purchase.unitCost = unitCost;
  purchase.total = total;
  for (const lot of state.stockLots) if (lot.purchaseId === id) lot.unitCost = unitCost;
}

export function updateSaleCosts(state: RetailState, id: string, input: {
  costs: Array<number | null>; commission: number; tax: number; cardFees: number[];
}) {
  const sale = state.sales.find((item) => item.id === id);
  if (!sale || sale.canceledAt) throw new RetailError("Venda ativa não encontrada.");
  const lines = sale.lines ?? [sale];
  const validAmount = (amount: number) => Number.isSafeInteger(amount) && amount >= 0;
  if (input.costs.length !== lines.length || input.costs.some((cost) => cost !== null && !validAmount(cost))) {
    throw new RetailError("Confira o custo de cada item.");
  }
  const total = lines.reduce((sum, line, index) => sum + (input.costs[index] ?? line.cost ?? 0), 0);
  if (!Number.isSafeInteger(total)) throw new RetailError("Custo total fora do limite.");
  if (!validAmount(input.commission) || !validAmount(input.tax) || input.tax > sale.total) {
    throw new RetailError("Confira a comissão e o imposto. O imposto não pode superar o total da venda.");
  }

  const cardPayments = (sale.payments ?? [{ method: sale.method, amount: sale.total }])
    .map((payment, index) => ({ payment, index })).filter(({ payment }) => payment.method === "Cartão");
  if (input.cardFees.length !== cardPayments.length ||
      input.cardFees.some((fee, index) => !validAmount(fee) || fee > cardPayments[index].payment.amount)) {
    throw new RetailError("A taxa de cartão deve estar entre zero e o valor de cada pagamento.");
  }

  const commissionEntry = state.ledger.find((entry) => entry.saleId === id && entry.kind === "comissao" && !entry.canceled);
  if (commissionEntry && settledAmount(commissionEntry) > input.commission) {
    throw new RetailError("A comissão informada é menor que o valor já pago. Revise a baixa no Financeiro.");
  }

  sale.lines?.forEach((line, index) => {
    const cost = input.costs[index];
    if (cost !== null) { line.cost = cost; line.missingCostUnits = 0; }
  });
  if (sale.lines || input.costs[0] !== null) sale.cost = total;
  sale.missingCostUnits = sale.lines
    ? sale.lines.reduce((sum, line) => sum + line.missingCostUnits, 0)
    : input.costs[0] === null ? sale.missingCostUnits : 0;

  if (input.tax !== (sale.tax?.amount ?? 0)) sale.tax = { name: sale.tax?.name ?? "Imposto manual", amount: input.tax };
  sale.commission = input.commission;
  if (commissionEntry) commissionEntry.amount = input.commission;
  else if (input.commission > 0) state.ledger.unshift({
    id: id + "-commission", saleId: id, store: sale.store, name: "Comissão" + (sale.sellerName ? " · " + sale.sellerName : ""),
    kind: "comissao", direction: "out", amount: input.commission, date: businessDate(new Date(sale.createdAt)), due: "", settlements: [],
  });

  sale.cardFees = input.cardFees.reduce((sum, fee) => sum + fee, 0);
  cardPayments.forEach(({ index }, position) => {
    const fee = input.cardFees[position];
    const payment = sale.payments?.[index];
    if (payment && payment.fee !== fee) { payment.fee = fee; delete payment.rate; }
    const receipt = state.ledger.find((entry) => entry.id === id + (sale.payments ? "-payment-" + index : "-receipt") && entry.kind === "venda");
    if (receipt && !receipt.canceled) {
      receipt.cardFee = fee;
      receipt.name = "Venda · Cartão" + (fee ? " · taxa " + money(fee) : "");
    }
  });
}

export function cancelSale(state: RetailState, id: string, date: string, refundConfirmed = false) {
  const sale = state.sales.find((item) => item.id === id);
  if (!sale) throw new RetailError("Venda não encontrada.");
  if (sale.canceledAt) return;
  if (tradeInAssets(state, sale.store).some((item) => item.saleId === id && item.resale)) {
    throw new RetailError("Esta venda tem um bem de troca já vendido.");
  }
  const linked = state.ledger.filter((entry) => entry.saleId === id);
  if (linked.some((entry) => entry.direction === "out" && settledAmount(entry))) {
    throw new RetailError("Há comissão ou repasse já pago. Regularize a baixa no Financeiro antes de cancelar.");
  }
  const received = linked.filter((entry) => entry.direction === "in" && !entry.nonCash).reduce((sum, entry) => sum + settledAmount(entry), 0);
  if (received && !refundConfirmed) throw new RetailError("Confirme a devolução do valor recebido antes de cancelar.");
  const lines = sale.lines ?? [sale];
  for (const [index, line] of lines.entries()) {
    changeStock(state, line.productId, sale.store, line.quantity, "Cancelamento de venda", sale.id + "-return-" + index, date, sale.id);
  }
  for (const lot of sale.allocations ?? []) {
    const purchase = state.purchases.find((item) => item.id === lot.purchaseId);
    addLot(state, purchase ? { ...lot, unitCost: purchase.unitCost, color: lot.color ?? (lot.variantId ? undefined : purchase.color) } : lot);
  }
  for (const entry of linked) entry.canceled = true;
  if (received) {
    const day = businessDate(new Date(date));
    state.ledger.unshift({ id: id + "-refund", store: sale.store, name: "Devolução · " + sale.productName, kind: "ajuste",
      direction: "out", amount: received, date: day, due: day, settlements: [{ id: id + "-refunded", amount: received, date: day }] });
  }
  sale.canceledAt = date;
}

export type CashAccount = {
  id: string; store: StoreId; name: string; kind: "Banco" | "Dinheiro";
  openingDate: string; openingBalance: number; defaultAccount: boolean; reviewDays: number; paymentMethod?: Exclude<SalePayment["method"], "Produto">;
};
export type CashAssignment = { entryId: string; settlementId: string; accountId: string };
export type CashReconciliation = {
  id: string; accountId: string; date: string; statementBalance: number; systemBalance: number;
  notes: string; actor: string;
};

export function cashMovements(state: RetailState) {
  const accounts = new Map((state.cashAccounts ?? []).map((account) => [account.id, account]));
  const defaults = new Map([...accounts.values()].filter((account) => account.defaultAccount).map((account) => [account.store, account]));
  const assignments = new Map((state.cashAssignments ?? []).map((item) => [JSON.stringify([item.entryId, item.settlementId]), item.accountId]));
  const sales = new Map(state.sales.map((sale) => [sale.id, sale]));
  const routes = new Map([...accounts.values()].filter((account) => account.paymentMethod)
    .map((account) => [JSON.stringify([account.store, account.paymentMethod]), account]));
  return state.ledger.flatMap((entry) => {
    const sale = entry.kind === "venda" && entry.saleId ? sales.get(entry.saleId) : undefined;
    const prefix = sale ? sale.id + "-payment-" : "";
    const method = sale && entry.id.startsWith(prefix)
      ? sale.payments?.[Number(entry.id.slice(prefix.length))]?.method : sale?.method;
    const route = routes.get(JSON.stringify([entry.store, method]));
    const dates = new Map(entry.settlements.map((payment) => [payment.id, payment.date]));
    return ledgerCashEvents(entry).filter((event) => event.amount !== 0).map((event) => {
      const key = JSON.stringify([entry.id, event.settlementId]);
      const assigned = assignments.get(key);
      const postedDate = dates.get(event.settlementId);
      const automatic = route && postedDate && postedDate >= route.openingDate ? route : defaults.get(entry.store);
      const account = assigned ? accounts.get(assigned) : automatic;
      const accountId = account && account.store === entry.store && postedDate && postedDate >= account.openingDate ? account.id : undefined;
      return { ...event, key, entryId: entry.id, store: entry.store, name: entry.name, accountId, postedDate };
    });
  });
}

export function cashBalance(account: CashAccount, movements: ReturnType<typeof cashMovements>, date: string) {
  if (date < account.openingDate) return 0;
  return account.openingBalance + movements.reduce((sum, movement) =>
    movement.accountId === account.id && movement.date <= date ? sum + movement.amount : sum, 0);
}

export const legacySaleCutoff = "2026-11-17T07:05:00.000Z";

export function canCorrectLegacySale(sale: Sale) {
  return !sale.canceledAt && Date.parse(sale.createdAt) < Date.parse(legacySaleCutoff);
}

export type HistoricalPayment = {
  method: SalePayment["method"]; amount: number; fee: number; status: "received" | "pending";
  date: string; assetDescription?: string; source?: string;
};

export function historicalPayments(state: RetailState, sale: Sale): HistoricalPayment[] {
  const entries = new Map(state.ledger.filter((entry) => entry.saleId === sale.id && entry.kind === "venda" && !entry.canceled).map((entry) => [entry.id, entry]));
  const payments = sale.payments ?? [{ method: sale.method, amount: sale.total, fee: sale.cardFees ?? 0, due: "", received: false, assetDescription: undefined }];
  const saleDate = businessDate(new Date(sale.createdAt));
  return payments.flatMap<HistoricalPayment>((payment, index) => {
    const id = sale.id + (sale.payments ? "-payment-" + index : "-receipt");
    const entry = entries.get(id);
    const active = entry?.settlements.filter((item) => !item.reversedOn) ?? [];
    let allocated = 0;
    const rows: HistoricalPayment[] = active.map((item) => {
      const before = allocated;
      allocated += item.amount;
      return { method: payment.method, amount: item.amount,
        fee: Math.round(allocated * payment.fee / payment.amount) - Math.round(before * payment.fee / payment.amount),
        status: "received", date: item.date, assetDescription: payment.assetDescription, source: item.id };
    });
    if (payment.amount > allocated) rows.push({ method: payment.method, amount: payment.amount - allocated,
      fee: payment.fee - Math.round(allocated * payment.fee / payment.amount), status: "pending",
      date: entry?.due || payment.due || saleDate, assetDescription: payment.assetDescription });
    return rows;
  });
}

export function correctHistoricalPayments(state: RetailState, id: string, rows: HistoricalPayment[], asOf: string) {
  const sale = state.sales.find((item) => item.id === id);
  if (!sale || !canCorrectLegacySale(sale)) throw new RetailError("Esta venda não está disponível para correção histórica.");
  const entries = state.ledger.filter((entry) => entry.saleId === id && entry.kind === "venda");
  if (entries.some((entry) => entry.canceled || entry.settlements.some((item) => item.reversedOn)) ||
      tradeInAssets(state, sale.store).some((item) => item.saleId === id && item.resale)) {
    throw new RetailError("Esta venda tem estorno registrado ou bem de troca revendido. O histórico não pode ser substituído.");
  }
  const date = businessDate(new Date(sale.createdAt));
  if (!rows.length || rows.length > 30 || rows.some((row) => !paymentMethods.includes(row.method) ||
      !Number.isSafeInteger(row.amount) || row.amount <= 0 || !Number.isSafeInteger(row.fee) || row.fee < 0 ||
      row.fee > row.amount || (row.method !== "Cartão" && row.fee !== 0) ||
      !isCalendarDate(row.date) || row.date < date || (row.status === "received" && row.date > asOf) ||
      (row.method === "Produto" && !row.assetDescription?.trim()))) {
    throw new RetailError("Confira valores, taxas e datas. Identifique o bem nos pagamentos em produto.");
  }
  if (rows.reduce((sum, row) => sum + row.amount, 0) !== sale.total) {
    throw new RetailError("A soma das formas de pagamento deve ser igual ao total da venda.");
  }

  const previousEntryIds = new Set(entries.map((entry) => entry.id));
  const previousAccounts = new Map(cashMovements(state).filter((move) => previousEntryIds.has(move.entryId) && !move.reversal)
    .map((move) => [move.settlementId, (state.cashAssignments ?? []).find((item) => item.entryId === move.entryId && item.settlementId === move.settlementId)?.accountId]));
  const sources = new Map(historicalPayments(state, sale).filter((row) => row.source).map((row) => [row.source, row]));
  const rememberedAccounts = (state.cashAssignments ?? []).filter((item) => !previousEntryIds.has(item.entryId));
  const replacements = rows.map((row, index): LedgerEntry => {
    const entryId = id + "-payment-" + index;
    const settlementId = entryId + "-received";
    const source = sources.get(row.source);
    const accountId = source?.method === row.method ? previousAccounts.get(row.source!) : undefined;
    const account = state.cashAccounts?.find((item) => item.id === accountId && item.store === sale.store && item.openingDate <= row.date);
    if (account && row.status === "received") rememberedAccounts.push({ entryId, settlementId, accountId: account.id });
    return { id: entryId, saleId: id, store: sale.store, name: "Venda · " + row.method, kind: "venda",
      direction: "in", amount: row.amount, date, due: row.date, cardFee: row.fee, nonCash: row.method === "Produto" || undefined,
      settlements: row.status === "received" ? [{ id: settlementId, date: row.date, amount: row.amount }] : [] };
  });
  state.cashAssignments = rememberedAccounts;
  state.ledger = [...replacements, ...state.ledger.filter((entry) => !previousEntryIds.has(entry.id))];
  sale.method = rows[0].method;
  sale.cardFees = rows.reduce((sum, row) => sum + row.fee, 0);
  sale.payments = rows.map((row) => ({ method: row.method, amount: row.amount, fee: row.fee, due: row.date,
    received: row.status === "received", assetDescription: row.method === "Produto" ? row.assetDescription : undefined }));
}

export function needsHistoricalPurchasePayment(state: RetailState, purchase: Purchase) {
  return !purchase.canceledAt && !purchase.openingBalance && purchase.acquisition !== "consignada" &&
    purchase.acquisition !== "a-pagar" && purchase.total > 0 &&
    !state.ledger.some((entry) => entry.id === purchase.id + "-payable");
}

export function registerHistoricalPurchasePayment(state: RetailState, id: string, paidOn: string, asOf: string) {
  const purchase = state.purchases.find((item) => item.id === id);
  if (!purchase || !needsHistoricalPurchasePayment(state, purchase)) throw new RetailError("Compra indisponível para regularizar o pagamento.");
  if (!isCalendarDate(paidOn) || paidOn < purchase.date || paidOn > asOf) throw new RetailError("Informe a data em que a compra foi paga.");
  purchase.acquisition = "quitada";
  state.ledger.unshift({ id: id + "-payable", store: purchase.store, name: "Compra · " + purchase.supplier, kind: "estoque",
    direction: "out", amount: purchase.total, date: purchase.date, due: paidOn,
    settlements: [{ id: id + "-paid", amount: purchase.total, date: paidOn }] });
}
