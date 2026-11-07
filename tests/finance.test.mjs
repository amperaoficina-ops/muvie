import assert from "node:assert/strict";
import test from "node:test";
import {
  balanceDue, cancelSale, emptyRetailState, financialReport, postMonthlyCosts, recordPurchase,
  recordSale, reverseSettlement, salesRanking, settleEntry, transferStock,
} from "../domain/retail.ts";

const date = "2026-11-07";
const time = date + "T12:00:00Z";
const store = "palhoca";
const purchase = { id: "p1", productId: "s1", store, supplier: "Fornecedor", contactId: "", quantity: 2,
  unitCost: 300000, date, createdAt: time, notes: "", invoiceNumber: "", acquisition: "consignada" };
const sale = { id: "v1", productId: "s1", store: "sao-jose", customer: "Cliente", contactId: "",
  quantity: 1, discount: 10000, method: "Pix", createdAt: time, sellerId: "e1", receive: { mode: "pending", due: date } };

function fixture() {
  const state = emptyRetailState();
  state.products.push({ id: "s1", sku: "S", name: "Bravus", category: "Scooter elétrica", price: 500000,
    description: "", imageUrl: "", published: true, stock: { "sao-jose": 0, palhoca: 0 } });
  state.staff.push({ id: "e1", name: "Alex", store: "sao-jose", job: "Vendedor", salary: 200000, commissionBps: 200, active: true });
  return state;
}

test("consignação transferida gera repasse só quando vendida e registra custo e comissão", () => {
  const state = fixture();
  recordPurchase(state, purchase);
  assert.equal(state.ledger.length, 0);
  transferStock(state, "s1", store, "sao-jose", 1, "t1", time);
  recordSale(state, sale);
  recordSale(state, sale);
  assert.equal(state.ledger.length, 3);
  assert.equal(state.sales[0].cost, 300000);
  assert.equal(state.sales[0].commission, 9800);
  assert.equal(state.ledger.find((entry) => entry.kind === "consignacao").store, "sao-jose");
  assert.equal(financialReport(state, date, date).outgoing, 0);
  assert.equal(financialReport(state, date, date, "sao-jose").result, 180200);
  assert.equal(financialReport(state, date, date, store).revenue, 0);
  assert.deepEqual(salesRanking(state, date, date, undefined, true), [{ label: "Alex", units: 1, amount: 490000 }]);
  cancelSale(state, sale.id, time);
  assert.equal(state.stockLots.find((item) => item.store === "sao-jose").quantity, 1);
  assert.ok(state.ledger.every((item) => item.canceled));
  assert.equal(financialReport(state, date, date).result, 0);
});

test("baixa parcial e estorno preservam o saldo e o caixa por data", () => {
  const state = fixture();
  recordPurchase(state, { ...purchase, acquisition: "a-pagar", due: "2026-11-20" });
  const entry = state.ledger[0];
  const payment = { id: "pag1", amount: 150000, date: "2026-11-08" };
  settleEntry(state, entry.id, payment);
  settleEntry(state, entry.id, payment);
  assert.equal(balanceDue(entry), 450000);
  assert.throws(() => settleEntry(state, entry.id, { ...payment, id: "pag2", amount: 500000 }));
  reverseSettlement(state, entry.id, payment.id, "2026-11-10");
  assert.equal(balanceDue(entry), 600000);
  assert.equal(financialReport(state, payment.date, payment.date).cash, -150000);
  assert.equal(financialReport(state, "2026-11-10", "2026-11-10").cash, 150000);
  assert.equal(financialReport(state, date, "2026-11-10").cost, 0);
});

test("mistura de saldo próprio avulso e consignação exige selecionar a origem", () => {
  const state = fixture();
  state.products[0].stock["sao-jose"] = 1;
  recordPurchase(state, { ...purchase, store: "sao-jose" });
  assert.throws(() => recordSale(state, sale), /Selecione o lote/);
  recordSale(state, { ...sale, origin: "legacy" });
  assert.equal(state.sales[0].missingCostUnits, 1);
  assert.equal(state.ledger.some((item) => item.kind === "consignacao"), false);
  assert.equal(state.stockLots[0].quantity, 2);
});

test("fixos e salários geram competência uma vez e preservam os valores lançados", () => {
  const state = fixture();
  state.fixedCosts.push({ id: "f1", store: "sao-jose", name: "Aluguel", amount: 350000, day: 31, active: true });
  postMonthlyCosts(state, "sao-jose", "2026-02");
  state.fixedCosts[0].amount = 370000;
  postMonthlyCosts(state, "sao-jose", "2026-02");
  assert.equal(state.ledger.length, 2);
  assert.ok(state.ledger.every((item) => item.due === "2026-02-28"));
  assert.equal(financialReport(state, "2026-02-01", "2026-02-28").result, -550000);
  assert.equal(financialReport(state, "2026-02-01", "2026-02-28").cash, 0);
});

test("cancelamento de venda recebida exige devolução e mantém histórico de caixa", () => {
  const state = fixture();
  recordPurchase(state, { ...purchase, store: "sao-jose", acquisition: "quitada" });
  recordSale(state, { ...sale, receive: { mode: "received", due: date } });
  assert.throws(() => cancelSale(state, sale.id, time));
  cancelSale(state, sale.id, "2026-11-08T12:00:00Z", true);
  assert.equal(financialReport(state, date, date).incoming, 490000);
  assert.equal(financialReport(state, "2026-11-08", "2026-11-08").outgoing, 490000);
  assert.equal(financialReport(state, date, "2026-11-08").revenue, 0);
});
