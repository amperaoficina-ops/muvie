import { createHash, randomUUID } from "node:crypto";
import { Binary, MongoClient } from "mongodb";
import { businessDate, emptyRetailState, postMonthlyCosts, recordPurchase, recordSale, transferStock } from "../domain/retail.ts";
import { localMongoConfig } from "../lib/mongo-config.ts";
import { hashPassword } from "../lib/security.ts";

const { uri, dbName } = localMongoConfig();
if (dbName !== "muvie_demo") throw new Error("A carga só pode ser executada em MONGODB_DB=muvie_demo.");
const email = process.env.MUVIE_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.MUVIE_ADMIN_PASSWORD;
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 12 || password.length > 256) {
  throw new Error("Configure o e-mail e uma senha de 12 a 256 caracteres no .env.demo.local.");
}
const client = new MongoClient(uri, { directConnection: true, serverSelectionTimeoutMS: 3000 });
try {
  const db = client.db(dbName);
  const now = new Date();
  const ago = (days) => new Date(now.getTime() - days * 86400000).toISOString();
  const state = emptyRetailState();
  const productId = "00000000-0000-4000-8000-000000000010";
  const purchaseId = "00000000-0000-4000-8000-000000000011";
  const saleId = "00000000-0000-4000-8000-000000000012";
  const contactId = "00000000-0000-4000-8000-000000000013";
  state.products.push({
    id: productId, sku: "DEMO-BRAVUS", name: "Bravus", category: "Scooter elétrica", price: 999000,
    purchaseCost: 680000, published: true, imageUrl: "/brand/bravus-branca.webp",
    description: "Modelo usado para demonstrar catálogo, estoque e atendimento.", stock: { "sao-jose": 0, palhoca: 0 },
  });
  state.contacts.push({
    id: contactId, name: "Cliente de demonstração", phone: "", email: "cliente@example.test",
    store: "palhoca", stage: "Proposta", interest: "Bravus", nextContact: "", notes: "Cadastro fictício.",
    createdAt: ago(10),
  });
  recordPurchase(state, {
    id: purchaseId, store: "sao-jose", productId, supplier: "Fornecedor de demonstração", contactId: "",
    quantity: 12, unitCost: 680000, date: ago(23).slice(0, 10), invoiceNumber: "DEMO-001", notes: "", createdAt: ago(23),
  });
  transferStock(state, productId, "sao-jose", "palhoca", 5, randomUUID(), ago(21));
  for (const [index, day, store] of [[0, 19, "sao-jose"], [1, 12, "palhoca"], [2, 6, "sao-jose"], [3, 1, "palhoca"]]) {
    recordSale(state, { id: index === 3 ? saleId : randomUUID(), store, productId, customer: "Cliente de demonstração",
      contactId: index === 3 ? contactId : "", quantity: index === 1 ? 2 : 1, discount: 10000 * index, method: "Cartão", createdAt: ago(day) });
  }
  for (const [mode, installments, basisPoints] of [["Débito", 1, 149], ["Crédito", 1, 329], ["Crédito", 6, 599], ["Crédito", 12, 999]]) {
    state.cardRates.push({ id: randomUUID(), name: "Maquininha demo", mode, installments, basisPoints });
  }
  state.testimonials.push({ id: randomUUID(), author: "Exemplo fictício · ambiente de demonstração", quote: "Gostei de comparar os modelos e ver as condições de pagamento antes de escolher." });
  state.audit.push({ id: randomUUID(), actor: email, action: "Carga de demonstração: compra, transferência e vendas de exemplo.", at: ago(0) });
  const inserted = await db.collection("app_state").updateOne({ _id: "retail" }, { $setOnInsert: { revision: 1, state } }, { upsert: true });
  if (inserted.upsertedCount) {
    for (const [owner, ownerId, kind] of [["purchase", purchaseId, "Compra"], ["sale", saleId, "Venda"]]) {
      const bytes = Buffer.from("<demonstracao>Arquivo ficticio, sem valor fiscal.</demonstracao>");
      const id = createHash("sha256").update(owner + ":" + ownerId + ":" + kind + ":").update(bytes).digest("hex");
      await db.collection("retail_invoices").updateOne({ _id: id }, { $setOnInsert: {
        owner, ownerId, kind, name: "exemplo-sem-valor-fiscal.xml", mime: "application/xml", createdAt: now, data: new Binary(bytes),
      } }, { upsert: true });
    }
  }
  const retail = db.collection("app_state");
  const document = await retail.findOne({ _id: "retail" });
  const demo = { ...emptyRetailState(), ...document.state };
  const ownedId = "00000000-0000-4000-8000-000000000020";
  if (demo.products.some((item) => item.id === productId && item.sku === "DEMO-BRAVUS" && item.price > 0) &&
    !demo.purchases.some((item) => item.id === ownedId)) {
    const today = businessDate(now);
    const month = today.slice(0, 7);
    const consignedId = randomUUID();
    demo.products.push({ id: consignedId, sku: "DEMO-URBAN", name: "Urban · Demo", category: "Scooter elétrica",
      price: 850000, published: false, imageUrl: "", description: "Modelo fictício para testar consignação.", stock: { "sao-jose": 0, palhoca: 0 } });
    for (const [index, store] of ["sao-jose", "palhoca"].entries()) {
      const sellerId = randomUUID();
      const model = index ? consignedId : productId;
      demo.staff.push({ id: sellerId, store, name: index ? "Rafa · Demo" : "Alex · Demo",
        job: "Vendas", salary: index ? 255000 : 285000, commissionBps: index ? 150 : 200, active: true });
      demo.fixedCosts.push({ id: randomUUID(), store, name: "Aluguel · Demo", amount: index ? 380000 : 520000, day: 10, active: true });
      demo.assets.push({ id: randomUUID(), store, name: "Balcão de atendimento · Demo", quantity: 1, amount: 160000, notes: "Exposição" });
      recordPurchase(demo, { id: index ? randomUUID() : ownedId, store, productId: model, supplier: "Fornecedor de demonstração",
        contactId: "", quantity: 3, unitCost: 680000, date: businessDate(new Date(ago(2))), due: today, acquisition: index ? "consignada" : "a-pagar",
        invoiceNumber: "", notes: "Registro fictício", createdAt: ago(2) });
      recordSale(demo, { id: randomUUID(), store, productId: model, customer: "Cliente de demonstração", contactId: "",
        quantity: 1, discount: 5000, method: "Pix", sellerId, createdAt: ago(0), receive: { mode: index ? "pending" : "received", due: today } });
      postMonthlyCosts(demo, store, month);
    }
    const result = await retail.updateOne({ _id: "retail", revision: document.revision }, { $set: { state: demo }, $inc: { revision: 1 } });
    if (!result.modifiedCount) throw new Error("O banco demo mudou durante a carga. Rode o comando novamente.");
    console.log("Exemplos financeiros adicionados às duas unidades.");
  }
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection("users").updateOne({ email }, { $setOnInsert: { email, name: "Admin demonstração", role: "admin", passwordHash: hashPassword(password) } }, { upsert: true });
  console.log(inserted.upsertedCount ? "Banco muvie_demo preenchido." : "Banco muvie_demo já preenchido. Os dados existentes foram preservados.");
} finally {
  await client.close();
}
