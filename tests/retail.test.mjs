import assert from "node:assert/strict";
import test from "node:test";
import { cancelPurchase, cancelSale, cardQuote, changeStock, classifyLegacyConsignment, emptyRetailState, financialReport, isCalendarDate, materializeCommitments, modelMarginRanking, recordCheckout, saleNetProfit, settleEntry, normalizeCpf, sellTradeInAsset, recordPurchase, recordSale, returnConsignedLot, stockComposition, tradeInAssets, transferStock, updateSaleCosts } from "../domain/retail.ts";
import { localMongoConfig } from "../lib/mongo-config.ts";

const date = "2026-11-07T12:00:00.000Z";

test("simulação conserva os centavos do total nas parcelas e no líquido", () => {
  const rate = { id: "1", name: "Cartão teste", mode: "Crédito", installments: 6, basisPoints: 599 };
  const gross = 999005;
  const quote = cardQuote(gross, rate);
  assert.equal(quote.fee, 59840);
  assert.equal(quote.net + quote.fee, gross);
  assert.equal(quote.installment * rate.installments + quote.remainder, gross);
});

function fixture() {
  const state = emptyRetailState();
  state.products.push({
    id: "scooter", sku: "SKU-1", name: "Scooter teste", category: "Scooter elétrica", price: 599900,
    description: "", imageUrl: "", published: false, stock: { "sao-jose": 3, palhoca: 1 },
  });
  return state;
}

const input = {
  id: "sale-1", store: "palhoca", productId: "scooter", customer: "Cliente teste",
  quantity: 1, discount: 10000, method: "Pix", contactId: "", createdAt: date,
};

test("venda baixa só o saldo da loja, calcula desconto em centavos e não duplica em nova tentativa", () => {
  const state = fixture();
  recordSale(state, input);
  recordSale(state, input);
  assert.deepEqual(state.products[0].stock, { "sao-jose": 3, palhoca: 0 });
  assert.equal(state.sales[0].total, 589900);
  assert.equal(state.sales.length, 1);
  assert.equal(state.movements.length, 1);
});

test("cancelamento devolve a quantidade uma vez e preserva o registro da venda", () => {
  const state = fixture();
  recordSale(state, input);
  cancelSale(state, input.id, date);
  cancelSale(state, input.id, date);
  assert.equal(state.products[0].stock.palhoca, 1);
  assert.equal(state.sales[0].canceledAt, date);
  assert.equal(state.movements.length, 2);
});

test("falta de saldo, desconto inválido e CRM de outra loja preservam o estado", () => {
  const state = fixture();
  state.contacts.push({ id: "contato", name: "Cliente SJ", store: "sao-jose", stage: "Novo" });
  const original = structuredClone(state);
  for (const fields of [{ quantity: 2 }, { discount: 599901 }, { contactId: "contato" }]) {
    assert.throws(() => recordSale(state, { ...input, ...fields }));
    assert.deepEqual(state, original);
  }
  assert.throws(() => changeStock(state, "scooter", "palhoca", -2, "Ajuste", "test", date));
  assert.deepEqual(state, original);
});

test("transferência gera uma saída e uma entrada com a mesma referência", () => {
  const state = fixture();
  transferStock(state, "scooter", "sao-jose", "palhoca", 2, "tr-1", date);
  assert.deepEqual(state.products[0].stock, { "sao-jose": 1, palhoca: 3 });
  assert.deepEqual(state.movements.map(({ store, quantity, reference }) => [store, quantity, reference]), [
    ["palhoca", 2, "tr-1"], ["sao-jose", -2, "tr-1"],
  ]);
  const previous = structuredClone(state);
  assert.throws(() => transferStock(state, "scooter", "sao-jose", "palhoca", 2, "tr-2", date));
  assert.deepEqual(state, previous);
});

const purchaseInput = {
  id: "purchase-1", store: "sao-jose", productId: "scooter", supplier: "Fornecedor teste",
  contactId: "", quantity: 2, unitCost: 320000, invoiceNumber: "123", notes: "",
  date: "2026-11-06", createdAt: date,
};

test("compra acrescenta saldo uma vez à unidade e preserva o preço de venda", () => {
  const state = fixture();
  state.products[0].specs = { battery: "60 V" };
  recordPurchase(state, { ...purchaseInput, specs: { battery: "72 V" } });
  recordPurchase(state, purchaseInput);
  assert.deepEqual(state.purchases[0].specs, { battery: "72 V" });
  assert.deepEqual(state.products[0].specs, { battery: "60 V" });
  assert.deepEqual(state.products[0].stock, { "sao-jose": 5, palhoca: 1 });
  assert.equal(state.products[0].price, 599900);
  assert.equal(state.purchases.length, 1);
  assert.equal(state.purchases[0].total, 640000);
  assert.equal(state.movements.length, 1);
  assert.equal(state.movements[0].reference, purchaseInput.id);
});

test("compra inválida mantém estoque e histórico intactos", () => {
  const state = fixture();
  const original = structuredClone(state);
  for (const fields of [{ date: "2026-02-30" }, { quantity: -1 }, { unitCost: 0 }, { contactId: "ausente" }]) {
    assert.throws(() => recordPurchase(state, { ...purchaseInput, ...fields }));
    assert.deepEqual(state, original);
  }
});

test("CPF opcional é normalizado e datas impossíveis são rejeitadas", () => {
  assert.equal(normalizeCpf(""), "");
  assert.equal(normalizeCpf("529.982.247-25"), "52998224725");
  assert.throws(() => normalizeCpf("111.111.111-11"));
  assert.throws(() => normalizeCpf("529.982.247-26"));
  assert.equal(isCalendarDate("2000-02-29"), true);
  assert.equal(isCalendarDate("2001-02-29"), false);
});

test("configuração rejeita banco da Ampera e hosts não locais", () => {
  const keys = ["MONGODB_URI", "MONGODB_DB"];
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";
    process.env.MONGODB_DB = "muvie_test";
    assert.equal(localMongoConfig().dbName, "muvie_test");
    process.env.MONGODB_DB = "ampera_production";
    assert.throws(localMongoConfig);
    process.env.MONGODB_DB = "muvie_test";
    process.env.MONGODB_URI = "mongodb://muvie.example:27017";
    assert.throws(localMongoConfig);
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});

test("classificação de saldo avulso e transferência preservam o total consignado", () => {
  const state = fixture();
  state.units = [{ id: "nova", name: "Nova unidade", code: "NV" }];
  const lot = { purchaseId: "origem", store: "sao-jose", productId: "scooter", quantity: 2,
    unitCost: 10000, consigned: true, supplier: "Fornecedor", date: "2026-11-07" };
  classifyLegacyConsignment(state, lot);
  assert.equal(state.products[0].stock["sao-jose"], 3);
  assert.throws(() => classifyLegacyConsignment(state, { ...lot, purchaseId: "outro" }));
  assert.equal(state.ledger.length, 0);
  transferStock(state, "scooter", "sao-jose", "nova", 1, "transf", date);
  assert.equal(stockComposition(state, "nova").consigned, 1);
  assert.equal(stockComposition(state).cost, 20000);
  assert.equal(stockComposition(state).owned, 2);
});

function linkOldStock(state, id, productId, store, unitCost) {
  recordPurchase(state, { id, productId, store, unitCost, quantity: 1, supplier: "Fornecedor",
    date: "2026-11-07", createdAt: date, acquisition: "quitada", openingBalance: true });
}

test("venda combinada contabiliza taxa e brinde, baixa parcial e devolve o estoque", () => {
  const state = fixture();
  state.products[0].purchaseCost = 300000;
  state.products.push({ ...state.products[0], id: "brinde", name: "Capacete", category: "Acessório", price: 0,
    purchaseCost: 15000, stock: { palhoca: 1 } });
  linkOldStock(state, "lote-scooter", "scooter", "palhoca", 300000);
  linkOldStock(state, "lote-brinde", "brinde", "palhoca", 15000);
  state.cardRates.push({ id: "rate", name: "Teste", mode: "Crédito", installments: 3, basisPoints: 500 });
  const checkout = { ...input, discount: 0, items: [
    { productId: "scooter", quantity: 1, gift: false, origin: "lote-scooter" },
    { productId: "brinde", quantity: 1, gift: true, origin: "lote-brinde" },
  ], payments: [
    { method: "Pix", amount: 99900, received: true, due: "" },
    { method: "Cartão", amount: 500000, received: false, due: "2026-11-08", rateId: "rate" },
  ] };
  const original = structuredClone(state);
  assert.throws(() => recordCheckout(state, { ...checkout, payments: [] }));
  assert.deepEqual(state, original);
  recordCheckout(state, checkout);
  recordCheckout(state, checkout);
  assert.equal(state.sales.length, 1);
  assert.equal(state.sales[0].cost, 315000);
  assert.equal(state.sales[0].cardFees, 25000);
  assert.equal(saleNetProfit(state.sales[0]), 259900);
  assert.equal(saleNetProfit({ ...state.sales[0], missingCostUnits: 1 }), null);
  const card = state.ledger.find((entry) => entry.cardFee);
  settleEntry(state, card.id, { id: "partial", amount: 200000, date: "2026-11-08" });
  const report = financialReport(state, "2026-11-07", "2026-11-08");
  assert.equal(report.cash, 289900);
  assert.equal(report.receivable, 300000);
  assert.equal(report.result, 259900);
  assert.equal(modelMarginRanking(state, "2026-11-07", "2026-11-08")[0].margin, 259900);
  assert.throws(() => cancelSale(state, input.id, "2026-11-09"));
  cancelSale(state, input.id, "2026-11-09", true);
  assert.equal(state.products[0].stock.palhoca, 1);
  assert.equal(state.products[1].stock.palhoca, 1);
});

test("imposto padrão calcula sobre a venda com desconto e o manual aceita zero", () => {
  const state = fixture();
  state.products[0].purchaseCost = 300000;
  linkOldStock(state, "lote-scooter", "scooter", "palhoca", 300000);
  linkOldStock(state, "lote-sj", "scooter", "sao-jose", 300000);
  state.taxRates = [{ id: "taxa", name: "Imposto de venda", basisPoints: 600, defaultForSale: true }];
  const checkout = { ...input, items: [{ productId: "scooter", quantity: 1, gift: false, origin: "lote-scooter" }],
    payments: [{ method: "Pix", amount: 589900, received: true, due: "" }] };
  assert.throws(() => recordCheckout(state, { ...checkout, manualTax: 589901 }));
  recordCheckout(state, checkout);
  assert.deepEqual(state.sales[0].tax, { name: "Imposto de venda", amount: 35394, basisPoints: 600 });
  state.taxRates[0].basisPoints = 1200;
  const report = financialReport(state, "2026-11-07", "2026-11-07");
  assert.equal(report.taxes, 35394);
  assert.equal(report.cash, 589900);
  assert.equal(report.result, 254506);
  recordCheckout(state, { ...checkout, id: "venda-manual", store: "sao-jose", manualTax: 0, items: [{ ...checkout.items[0], origin: "lote-sj" }] });
  assert.equal(state.sales[0].tax.amount, 0);
});

test("correção dos encargos atualiza caixa, lucro e comissão a pagar", () => {
  const state = fixture();
  linkOldStock(state, "lote", "scooter", "palhoca", 300000);
  state.cardRates.push({ id: "rate", name: "Teste", mode: "Crédito", installments: 1, basisPoints: 200 });
  recordCheckout(state, { ...input, items: [{ productId: "scooter", quantity: 1, gift: false, origin: "lote" }],
    payments: [{ method: "Pix", amount: 100000, received: true, due: "" }, { method: "Cartão", amount: 489900, received: true, due: "", rateId: "rate" }] });
  const adjustment = { costs: [null], commission: 10000, tax: 9000, cardFees: [5000] };
  updateSaleCosts(state, input.id, adjustment);
  const report = financialReport(state, "2026-11-07", "2026-11-07", "palhoca");
  assert.equal(report.cash, 584900);
  assert.equal(report.payable, 10000);
  assert.equal(report.result, 265900);
  assert.equal(saleNetProfit(state.sales[0]), report.result);
  const entry = state.ledger.find((row) => row.kind === "comissao");
  settleEntry(state, entry.id, { id: "comissao-parcial", amount: 4000, date: "2026-11-07" });
  const snapshot = structuredClone(state);
  assert.throws(() => updateSaleCosts(state, input.id, { ...adjustment, commission: 3999 }));
  assert.deepEqual(state, snapshot);
});

test("devolução consignada baixa apenas o lote escolhido e não gera lançamento financeiro", () => {
  const state = fixture();
  for (const id of ["lote-a", "lote-b"]) {
    recordPurchase(state, { id, productId: "scooter", store: "sao-jose", unitCost: 10000, quantity: 1,
      supplier: id, date: "2026-11-07", createdAt: date, acquisition: "consignada", openingBalance: true });
  }
  const input = { id: "devolucao", purchaseId: "lote-b", productId: "scooter", store: "sao-jose", quantity: 1, createdAt: date };
  assert.throws(() => returnConsignedLot(state, { ...input, quantity: 2 }));
  returnConsignedLot(state, input);
  returnConsignedLot(state, input);
  assert.equal(state.products[0].stock["sao-jose"], 2);
  assert.equal(state.stockLots.find((lot) => lot.purchaseId === "lote-a").quantity, 1);
  assert.equal(state.stockLots.find((lot) => lot.purchaseId === "lote-b").quantity, 0);
  assert.equal(state.movements.length, 1);
  assert.equal(state.ledger.length, 0);
});

test("cancelamento de compra quitada estorna o caixa e retira o lote das unidades uma vez", () => {
  const state = fixture();
  recordPurchase(state, { id: "compra", productId: "scooter", store: "sao-jose", supplier: "Fornecedor",
    date: "2026-11-07", createdAt: date, quantity: 2, unitCost: 10000, acquisition: "quitada" });
  transferStock(state, "scooter", "sao-jose", "palhoca", 1, "transferencia", date);
  const snapshot = structuredClone(state);
  assert.throws(() => cancelPurchase(state, "compra", date), /pagamentos/);
  assert.deepEqual(state, snapshot);
  cancelPurchase(state, "compra", date, true);
  cancelPurchase(state, "compra", date, true);
  assert.deepEqual(state.products[0].stock, { "sao-jose": 3, palhoca: 1 });
  assert.equal(state.movements.filter((row) => row.id.startsWith("compra-cancel-")).length, 2);
  assert.equal(financialReport(state, "2026-11-07", "2026-11-07").cash, 0);
});

test("cancelamento preserva o saldo anterior e bloqueia lotes com unidades já baixadas", () => {
  const state = fixture();
  linkOldStock(state, "lote", "scooter", "palhoca", 10000);
  changeStock(state, "scooter", "palhoca", -1, "Saída", "saida", date);
  assert.throws(() => cancelPurchase(state, "lote", date), /incompleto/);
  linkOldStock(state, "lote-sj", "scooter", "sao-jose", 10000);
  cancelPurchase(state, "lote-sj", date);
  assert.equal(state.products[0].stock["sao-jose"], 3);
});

test("produto recebido na troca quita a venda sem entrar no caixa", () => {
  const state = fixture();
  linkOldStock(state, "lote", "scooter", "palhoca", 300000);
  recordCheckout(state, { ...input, items: [{ productId: "scooter", quantity: 1, gift: false, origin: "lote" }],
    payments: [{ method: "Pix", amount: 389900, received: true, due: "" },
      { method: "Produto", amount: 200000, received: true, due: "", assetDescription: "Scooter usada" }] });
  const report = financialReport(state, "2026-11-07", "2026-11-07", "palhoca");
  assert.equal(report.revenue, 589900);
  assert.equal(report.cash, 389900);
  assert.equal(report.receivable, 0);
  assert.deepEqual(tradeInAssets(state, "palhoca").map(({ name, amount, received }) => ({ name, amount, received })), [
    { name: "Scooter usada", amount: 200000, received: true },
  ]);
  assert.deepEqual(tradeInAssets(state, "sao-jose"), []);
  cancelSale(state, input.id, date, true);
  assert.deepEqual(tradeInAssets(state), []);
});

test("revenda de bem recebido registra caixa na unidade de origem uma única vez", () => {
  const state = fixture();
  linkOldStock(state, "lote", "scooter", "palhoca", 300000);
  recordCheckout(state, { ...input, items: [{ productId: "scooter", quantity: 1, gift: false, origin: "lote" }],
    payments: [{ method: "Produto", amount: 589900, received: true, due: "" }] });
  const [asset] = tradeInAssets(state);
  sellTradeInAsset(state, asset.id, 420000, "2026-11-08");
  sellTradeInAsset(state, asset.id, 420000, "2026-11-08");
  assert.equal(financialReport(state, "2026-11-08", "2026-11-08", "palhoca").cash, 420000);
  assert.equal(financialReport(state, "2026-11-08", "2026-11-08", "sao-jose").cash, 0);
  assert.equal(tradeInAssets(state)[0].resale.amount, 420000);
  assert.throws(() => cancelSale(state, input.id, date, true), /bem de troca já vendido/);
});

test("recorrência mensal ajusta dias inexistentes, respeita duração e não duplica lançamentos", () => {
  const state = fixture();
  const template = { id: "aluguel", store: "sao-jose", name: "Aluguel", kind: "despesa", direction: "out",
    amount: 100000, date: "2026-01-31", due: "2026-01-31", settlements: [], recurrence: { months: 3, due: "2026-01-31" } };
  state.ledger.push(template);
  materializeCommitments(state, "2026-02-01");
  materializeCommitments(state, "2026-04-01");
  assert.deepEqual(state.ledger.map((entry) => entry.date), ["2026-01-31", "2026-02-28", "2026-03-31"]);
  assert.equal(financialReport(state, "2026-02-01", "2026-02-28", "sao-jose").expenses, 100000);
  template.recurrence = { due: "2026-01-31", endedOn: "2026-03-10" };
  materializeCommitments(state, "2026-05-01");
  assert.equal(state.ledger.length, 3);
});
