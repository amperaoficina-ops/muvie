"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  acquisitionTypes, cancelSale, changeStock, isCalendarDate, normalizeCpf, paymentMethods, productCategories, recordPurchase, recordSale,
  postMonthlyCosts, reverseSettlement, settleEntry, RetailError, stages, stores, transferStock, type RetailState,
} from "@/domain/retail";
import { scooterCategory, scooterFields, type ScooterSpecs } from "@/domain/scooter";
import { requireUser, type User } from "@/lib/auth";
import { accessFor, canAccess, isPrimaryAdmin, moduleKeys, roles, type Module, type Role } from "@/domain/access";
import { getMongoDb } from "@/lib/mongodb";
import { hashPassword } from "@/lib/security";
import { storeProductPhoto } from "@/lib/product-photos";
import { invoiceKinds, invoiceOwners, storeInvoice } from "@/lib/invoices";
import { editRetail, readRetail } from "@/lib/retail-store";

const storeIds = stores.map((store) => store.id);
type Tab = Module;
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const localToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
const states = ["", "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

function value(form: FormData, key: string, max = 140, required = true) {
  const input = form.get(key);
  const result = typeof input === "string" ? input.trim() : "";
  if (result.length > max || (required && !result)) throw new RetailError("Confira os campos obrigatórios e seus limites.");
  return result;
}

function readScooterSpecs(form: FormData): ScooterSpecs {
  const specs: ScooterSpecs = {};
  for (const { key } of scooterFields) {
    const field = value(form, `scooter-${key}`, 120, false);
    if (field) specs[key] = field;
  }
  return specs;
}

function choice<T extends string>(form: FormData, key: string, choices: readonly T[]): T {
  const input = value(form, key);
  const match = choices.find((item) => item === input);
  if (!match) throw new RetailError("Selecione uma opção válida.");
  return match;
}

function amount(form: FormData, key: string) {
  const input = value(form, key, 12, false).replace(",", ".");
  if (!input) return 0;
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(input)) throw new RetailError("Informe um valor em reais com até duas casas decimais.");
  return Math.round(Number(input) * 100);
}

function units(form: FormData) {
  const input = value(form, "quantity", 6);
  const quantity = Number(input);
  if (!/^\d+$/.test(input) || quantity <= 0) throw new RetailError("Informe uma quantidade inteira maior que zero.");
  return quantity;
}

async function runAction(form: FormData, tab: Tab, message: string, execute: (user: User) => Promise<void>, refreshCatalog = false) {
  const user = await requireUser();
  const filter = form.get("filter");
  const params = new URLSearchParams({ tab });
  for (const key of ["inicio", "fim"]) {
    const date = form.get(key);
    if (typeof date === "string" && isCalendarDate(date)) params.set(key, date);
  }
  if (storeIds.some((store) => store === filter)) params.set("loja", String(filter));
  const focus = form.get("focus");
  if (typeof focus === "string" && uuidPattern.test(focus)) params.set("ficha", focus);
  try {
    if (!canAccess(user, tab)) throw new RetailError("Sua conta não tem acesso a este módulo.");
    await execute(user);
    if (refreshCatalog) {
      revalidatePath("/");
      revalidatePath("/modelos");
    }
    revalidatePath("/admin");
    params.set("ok", message);
  } catch (error) {
    if (!(error instanceof RetailError)) console.error("Erro ao gravar operação MUVI-E", error instanceof Error ? error.name : "Erro");
    params.set("erro", error instanceof RetailError ? error.message : "Não foi possível salvar no banco local. Tente novamente.");
  }
  redirect("/admin?" + params);
}

function commit(form: FormData, tab: Tab, message: string, edit: (state: RetailState) => void) {
  return runAction(form, tab, message, (user) => editWithAudit(user, message, edit), tab === "produtos" || tab === "relatos");
}

function editWithAudit(user: User, action: string, edit: (state: RetailState) => void) {
  const event = { id: randomUUID(), actor: user.email, action, at: new Date().toISOString() };
  return editRetail((state) => {
    edit(state);
    state.audit = [event, ...state.audit].slice(0, 2000);
  });
}

export async function saveProduct(form: FormData) {
  const newId = randomUUID();
  await runAction(form, "produtos", "Produto salvo.", async (user) => {
    const photo = form.get("photo");
    const uploaded = photo instanceof File && photo.size ? await storeProductPhoto(photo) : undefined;
    await editWithAudit(user, "Produto salvo.", (state) => {
    const id = value(form, "id", 36, false);
    const current = id ? state.products.find((product) => product.id === id) : undefined;
    if (id && !current) throw new RetailError("Produto não encontrado.");
    const sku = value(form, "sku", 40).toUpperCase();
    if (state.products.some((product) => product.sku === sku && product.id !== id)) throw new RetailError("Já existe um produto com este SKU.");
    const imageUrl = uploaded ?? (form.get("removePhoto") === "on" ? "" : current?.imageUrl ?? "");
    const category = choice(form, "category", productCategories);
    const fields = {
      sku, name: value(form, "name", 100), category,
      specs: category === scooterCategory ? readScooterSpecs(form) : null,
      price: amount(form, "price"),
      purchaseCost: value(form, "purchaseCost", 12, false) ? amount(form, "purchaseCost") : null,
      description: value(form, "description", 350, false),
      published: form.get("published") === "on", imageUrl,
    };
    if (current) Object.assign(current, fields);
    else state.products.push({ id: newId, ...fields, stock: { "sao-jose": 0, palhoca: 0 } });
    });
  }, true);
}

export async function saveRate(form: FormData) {
  const newId = randomUUID();
  await commit(form, "taxas", "Taxa de cartão salva.", (state) => {
    const id = value(form, "id", 36, false);
    const current = state.cardRates.find((rate) => rate.id === id);
    if (id && !current) throw new RetailError("Taxa não encontrada.");
    const mode = choice(form, "mode", ["Débito", "Crédito"]);
    const installments = Number(value(form, "installments", 2));
    if (!Number.isInteger(installments) || installments < 1 || installments > 24 || (mode === "Débito" && installments !== 1)) {
      throw new RetailError("Use 1 parcela no débito e até 24 no crédito.");
    }
    value(form, "percent", 6);
    const basisPoints = amount(form, "percent");
    if (basisPoints >= 10000) throw new RetailError("Informe uma taxa inferior a 100%.");
    const fields = { name: value(form, "name", 70), mode, installments, basisPoints };
    if (current) Object.assign(current, fields);
    else state.cardRates.push({ id: newId, ...fields });
  });
}

export async function saveTestimonial(form: FormData) {
  const newId = randomUUID();
  await commit(form, "relatos", "Relato atualizado.", (state) => {
    const id = value(form, "id", 36, false);
    if (id && form.get("remove") === "yes") {
      state.testimonials = state.testimonials.filter((item) => item.id !== id);
      return;
    }
    state.testimonials.unshift({ id: newId, author: value(form, "author", 70), quote: value(form, "quote", 320) });
  });
}

export async function saveUser(form: FormData) {
  await runAction(form, "usuarios", "Usuário salvo.", async (actor) => {
    const email = value(form, "email", 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RetailError("Informe um e-mail válido.");
    const db = await getMongoDb();
    const users = db.collection<User>("users");
    const editing = form.get("edit") === "yes";
    const current = editing ? await users.findOne({ email }) : null;
    if (editing && !current) throw new RetailError("Usuário não encontrado.");
    if (current && (email === actor.email || isPrimaryAdmin(current))) throw new RetailError("Esta conta está protegida para manter o acesso ao painel.");
    const role = choice(form, "role", Object.keys(roles) as Role[]);
    if ((role === "admin" || current?.role === "admin") && !isPrimaryAdmin(actor)) {
      throw new RetailError("Somente o administrador principal pode configurar outros administradores.");
    }
    const requested = form.getAll("permission");
    const permissions = form.get("permissionMode") === "custom" ? moduleKeys.filter((key) => requested.includes(key) && (key !== "usuarios" || role === "admin")) : null;
    const fields = { role, permissions, managed: true, name: value(form, "name", 100), disabled: editing && form.get("active") !== "on" };
    if (!accessFor(fields).length) throw new RetailError("Selecione ao menos um módulo de acesso.");
    if (current) {
      await users.updateOne({ _id: current._id }, { $set: fields });
      if (fields.disabled) await db.collection("sessions").deleteMany({ userEmail: email });
    } else {
      const password = form.get("password");
      if (typeof password !== "string" || password.length < 12 || password.length > 256) throw new RetailError("Use uma senha de 12 a 256 caracteres.");
      await users.createIndex({ email: 1 }, { unique: true });
      const result = await users.updateOne({ email }, { $setOnInsert: {
        ...fields, email, passwordHash: hashPassword(password),
      } }, { upsert: true });
      if (!result.upsertedCount) throw new RetailError("Este e-mail já está cadastrado.");
    }
    await editWithAudit(actor, "Acesso de usuário atualizado: " + email, () => {});
  });
}

export async function updateStock(form: FormData) {
  const id = randomUUID();
  const date = new Date().toISOString();
  await commit(form, "estoque", "Estoque atualizado.", (state) => {
    const mode = choice(form, "mode", ["entrada", "saida", "transferencia"]);
    const product = value(form, "productId");
    const store = choice(form, "store", storeIds);
    const quantity = units(form);
    if (mode === "transferencia") transferStock(state, product, store, store === "palhoca" ? "sao-jose" : "palhoca", quantity, id, date);
    else changeStock(state, product, store, mode === "entrada" ? quantity : -quantity, value(form, "reason", 100), id, date);
  });
}

export async function saveSale(form: FormData) {
  const createdAt = new Date().toISOString();
  await commit(form, "vendas", "Venda registrada.", (state) => {
    const id = value(form, "saleId", 36);
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new RetailError("Reabra o formulário de venda.");
    recordSale(state, {
      id, store: choice(form, "store", storeIds), productId: value(form, "productId"),
      customer: value(form, "customer", 100, false), contactId: value(form, "contactId", 36, false),
      quantity: units(form), discount: amount(form, "discount"),
      method: choice(form, "method", paymentMethods), createdAt,
      sellerId: value(form, "sellerId", 36, false),
      origin: value(form, "origin", 36, false),
      receive: form.has("receive") ? { mode: choice(form, "receive", ["pending", "received"]), due: value(form, "due", 10, false) } : undefined,
    });
  });
}

export async function savePurchase(form: FormData) {
  const createdAt = new Date().toISOString();
  await commit(form, "compras", "Compra registrada e estoque atualizado.", (state) => {
    const id = value(form, "purchaseId", 36);
    if (!uuidPattern.test(id)) throw new RetailError("Reabra o formulário de compra.");
    const date = value(form, "date", 10);
    if (!isCalendarDate(date) || date > localToday()) throw new RetailError("Informe uma data de compra válida, até hoje.");
    const productId = value(form, "productId");
    const product = state.products.find((item) => item.id === productId);
    recordPurchase(state, {
      id, date, createdAt, store: choice(form, "store", storeIds), productId,
      ...(product?.category === scooterCategory && { specs: readScooterSpecs(form) }),
      supplier: value(form, "supplier", 100, false), contactId: value(form, "contactId", 36, false),
      quantity: units(form), unitCost: amount(form, "unitCost"),
      invoiceNumber: value(form, "invoiceNumber", 44, false), notes: value(form, "notes", 500, false),
      acquisition: form.has("acquisition") ? choice(form, "acquisition", acquisitionTypes) : undefined,
      due: value(form, "due", 10, false),
    });
  });
}

export async function attachInvoice(form: FormData) {
  const owner = form.get("owner");
  const tab = owner === "purchase" ? "compras" : owner === "sale" ? "vendas" : "crm";
  await runAction(form, tab, "Nota fiscal anexada.", async (user) => {
    const type = choice(form, "owner", invoiceOwners);
    const ownerId = value(form, "ownerId", 36);
    const kind = type === "purchase" ? "Compra" : type === "sale" ? "Venda" : choice(form, "kind", invoiceKinds);
    const file = form.get("invoice");
    if (!(file instanceof File)) throw new RetailError("Selecione um arquivo em PDF ou XML.");
    const state = await readRetail();
    const owners = type === "purchase" ? state.purchases : type === "sale" ? state.sales : state.contacts;
    if (!owners.some((item) => item.id === ownerId)) throw new RetailError("O registro da nota fiscal não foi encontrado.");
    await storeInvoice(type, ownerId, kind, file);
    await editWithAudit(user, "Nota fiscal anexada (" + kind + ").", () => {});
  });
}

export async function reverseSale(form: FormData) {
  const date = new Date().toISOString();
  await commit(form, "vendas", "Venda cancelada e estoque devolvido.", (state) => cancelSale(state, value(form, "saleId"), date, form.get("refund") === "on"));
}

function requiredDate(form: FormData, key: string, allowFuture = false) {
  const date = value(form, key, 10);
  if (!isCalendarDate(date) || (!allowFuture && date > localToday())) throw new RetailError("Informe uma data válida.");
  return date;
}

export async function saveStoreItem(form: FormData) {
  const newId = randomUUID();
  await commit(form, "lojas", "Cadastro da unidade atualizado.", (state) => {
    const store = choice(form, "store", storeIds);
    const kind = choice(form, "kind", ["staff", "fixed", "asset"]);
    const id = value(form, "id", 36, false);
    const fields = { id: id || newId, store, name: value(form, "name", 100) };
    if (kind === "staff") {
      const commissionBps = amount(form, "commission");
      if (commissionBps > 10000) throw new RetailError("A comissão deve ser de até 100%.");
      const item = { ...fields, salary: amount(form, "salary"), commissionBps, job: value(form, "job", 70), active: form.get("active") === "on" };
      const existing = state.staff.find((row) => row.id === id && row.store === store);
      if (id && !existing) throw new RetailError("Funcionário não encontrado nesta unidade.");
      if (existing) Object.assign(existing, item);
      else state.staff.push(item);
    } else if (kind === "fixed") {
      const day = Number(value(form, "day", 2));
      const cost = amount(form, "amount");
      if (!Number.isInteger(day) || day < 1 || day > 31 || cost <= 0) throw new RetailError("Informe um valor positivo e um dia de 1 a 31.");
      const item = { ...fields, amount: cost, day, active: form.get("active") === "on" };
      const existing = state.fixedCosts.find((row) => row.id === id && row.store === store);
      if (id && !existing) throw new RetailError("Custo fixo não encontrado nesta unidade.");
      if (existing) Object.assign(existing, item);
      else state.fixedCosts.push(item);
    } else {
      const item = { ...fields, quantity: units(form), amount: amount(form, "amount"), notes: value(form, "notes", 500, false) };
      const existing = state.assets.find((row) => row.id === id && row.store === store);
      if (id && !existing) throw new RetailError("Item de estrutura não encontrado nesta unidade.");
      if (existing) Object.assign(existing, item);
      else state.assets.push(item);
    }
  });
}

export async function launchMonth(form: FormData) {
  await commit(form, "lojas", "Custos fixos e salários do mês lançados. Lançamentos existentes foram preservados.", (state) => {
    const month = value(form, "month", 7);
    postMonthlyCosts(state, choice(form, "store", storeIds), month);
  });
}

export async function saveLedgerEntry(form: FormData) {
  await commit(form, "financeiro", "Compromisso lançado.", (state) => {
    const id = value(form, "entryId", 36);
    if (!uuidPattern.test(id)) throw new RetailError("Reabra o formulário.");
    if (state.ledger.some((item) => item.id === id)) return;
    const direction = choice(form, "direction", ["in", "out"]);
    const classification = form.has("classification") ? choice(form, "classification", ["operacional", "somente-caixa"]) : "operacional";
    const date = requiredDate(form, "date", true);
    const due = requiredDate(form, "due", true);
    const total = amount(form, "amount");
    if (total <= 0 || due < date) throw new RetailError("Informe valor positivo e vencimento a partir da data do lançamento.");
    state.ledger.unshift({ id, store: choice(form, "store", storeIds), name: value(form, "name", 120),
      direction, kind: classification === "somente-caixa" ? "ajuste" : direction === "in" ? "outra-receita" : "despesa",
      amount: total, date, due, settlements: [], manual: true });
  });
}

export async function updateLedger(form: FormData) {
  const paymentId = randomUUID();
  await commit(form, "financeiro", "Financeiro atualizado.", (state) => {
    const id = value(form, "id");
    const entry = state.ledger.find((item) => item.id === id && !item.canceled);
    if (!entry) throw new RetailError("Compromisso indisponível.");
    const mode = choice(form, "mode", ["pay", "reverse", "schedule", "cancel"]);
    if (mode === "cancel") {
      if (!entry.manual || entry.settlements.some((payment) => !payment.reversedOn)) throw new RetailError("Só é possível cancelar um compromisso manual sem baixas ativas.");
      entry.canceled = true;
      return;
    }
    const date = requiredDate(form, "date", mode === "schedule");
    if (mode === "pay") {
      const token = value(form, "paymentId", 36, false);
      settleEntry(state, id, { id: uuidPattern.test(token) ? token : paymentId, amount: amount(form, "amount"), date });
    } else if (mode === "reverse") reverseSettlement(state, id, value(form, "settlementId"), date);
    else {
      if (date < entry.date) throw new RetailError("O vencimento deve ser igual ou posterior ao lançamento.");
      entry.due = date;
    }
  });
}

export async function saveContact(form: FormData) {
  const newId = randomUUID();
  const createdAt = new Date().toISOString();
  await commit(form, "crm", "Contato salvo.", (state) => {
    const id = value(form, "id", 36, false);
    const contact = id ? state.contacts.find((item) => item.id === id) : undefined;
    if (id && !contact) throw new RetailError("Contato não encontrado.");
    const nextContact = value(form, "nextContact", 10, false);
    if (nextContact && !isCalendarDate(nextContact)) throw new RetailError("Informe uma data de retorno válida.");
    const birthDate = value(form, "birthDate", 10, false);
    if (birthDate && (!isCalendarDate(birthDate) || birthDate < "1900-01-01" || birthDate > localToday())) throw new RetailError("Informe uma data de nascimento válida.");
    const email = value(form, "email", 254, false);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RetailError("Informe um e-mail válido.");
    const cpf = normalizeCpf(value(form, "cpf", 20, false));
    if (cpf && state.contacts.some((item) => item.id !== id && item.cpf === cpf)) throw new RetailError("Este CPF já está cadastrado em outro cliente.");
    const postalCode = value(form, "postalCode", 9, false).replace("-", "");
    if (postalCode && !/^\d{8}$/.test(postalCode)) throw new RetailError("Informe um CEP com 8 dígitos.");
    const uf = value(form, "uf", 2, false).toUpperCase();
    if (!states.includes(uf)) throw new RetailError("Informe uma UF válida.");
    const fields = {
      name: value(form, "name", 100), phone: value(form, "phone", 32, false),
      email, cpf, birthDate,
      address: {
        postalCode, street: value(form, "street", 120, false), number: value(form, "number", 16, false),
        complement: value(form, "complement", 100, false), neighborhood: value(form, "neighborhood", 80, false),
        city: value(form, "city", 80, false), state: uf,
      },
      store: choice(form, "store", storeIds), stage: choice(form, "stage", stages),
      interest: value(form, "interest", 100, false), nextContact, notes: value(form, "notes", 500, false),
    };
    if (contact) Object.assign(contact, fields);
    else state.contacts.unshift({ id: newId, ...fields, createdAt });
  });
}
