import assert from "node:assert/strict";
import test from "node:test";
import { cancelSale, cardQuote, changeStock, classifyLegacyConsignment, emptyRetailState, isCalendarDate, normalizeCpf, recordPurchase, recordSale, stockComposition, transferStock } from "../domain/retail.ts";
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
