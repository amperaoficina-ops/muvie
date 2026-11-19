"use server";

import { productColors } from "@/domain/product-colors";
import { parseReais } from "@/domain/money-input";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteProduct, correctHistoricalPayments, registerHistoricalPurchasePayment, cashBalance, cashMovements, acquisitionTypes, cancelPurchase, cancelSale, changeStock, isCalendarDate, normalizeCpf, paymentMethods, productCategories, recordPurchase, submitStoreSale, reviewStoreSale, cardReceivables, reconcileCardReceipt, sellerMinimumProfit, saleNetProfit, recordProfitDistribution, legacyCardMachine, cardMachineIsActive, rateMachineId, updateSaleCosts, updatePurchaseCost, setPurchaseLotColors,
  postMonthlyCosts, returnConsignedLot, reverseSettlement, saveSupplierRecord, sellTradeInAsset, settleEntry, RetailError, stages, stockLotForMovement, storeList, transferStock, type RetailState,
} from "@/domain/retail";
import { scooterCategory, scooterFields, type ScooterSpecs } from "@/domain/scooter";
import { requireUser, type User } from "@/lib/auth";
import { accessFor, canAccess, isDirector, isPrimaryAdmin, moduleKeys, roles, invoiceModule, type Module, type Role } from "@/domain/access";
import { storeContract } from "@/lib/contracts";
import { saveCashStatement } from "@/lib/cash-statements";
import { getMongoDb } from "@/lib/mongodb";
import { hashPassword } from "@/lib/security";
import { storeProductPhoto } from "@/lib/product-photos";
import { invoiceKinds, invoiceOwners, prepareInvoice, storeInvoice } from "@/lib/invoices";
import { editRetail, readRetail } from "@/lib/retail-store";

const storeIds = (state: RetailState) => storeList(state).map((store) => store.id);
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
  const cents = parseReais(value(form, key, 32, false));
  if (cents === null) throw new RetailError("Informe um valor em reais, como 7.990,00, com até duas casas decimais.");
  return cents;
}

function units(form: FormData) {
  const input = value(form, "quantity", 6);
  const quantity = Number(input);
  if (!/^\d+$/.test(input) || quantity <= 0) throw new RetailError("Informe uma quantidade inteira maior que zero.");
  return quantity;
}

async function runAction(form: FormData, tab: Tab, message: string | (() => string), execute: (user: User) => Promise<void>, refreshCatalog = false) {
  const user = await requireUser();
  const filter = form.get("filter");
  const params = new URLSearchParams({ tab });
  const category = form.get("stockCategory");
  if (tab === "estoque" && productCategories.some((item) => item === category)) params.set("categoria", String(category));
  if (tab === "caixa") {
    const account = form.get("conta");
    if (typeof account === "string" && (uuidPattern.test(account) || account === "sem-conta")) params.set("conta", account);
    const direction = form.get("caixaTipo");
    if (direction === "entradas" || direction === "saidas") params.set("caixaTipo", direction);
    if (form.get("caixaVisao") === "cartao") params.set("caixaVisao", "cartao");
    const page = form.get("caixaPagina");
    if (typeof page === "string" && /^\d{1,8}$/.test(page)) params.set("caixaPagina", page);
  }
  if (tab === "catalogo") {
    const page = form.get("catalogoPagina");
    if (typeof page === "string" && /^\d{1,8}$/.test(page)) params.set("catalogoPagina", page);
  }
  if (tab === "compromissos") {
    for (const key of ["tipoCompromisso", "prazoCompromisso", "compromissosVisao"]) {
      const filter = form.get(key);
      if (typeof filter === "string" && /^[a-z-]{1,30}$/.test(filter)) params.set(key, filter);
    }
    for (const key of ["baixaInicio", "baixaFim"]) {
      const date = form.get(key);
      if (typeof date === "string" && isCalendarDate(date)) params.set(key, date);
    }
  }
  if (tab === "taxas") {
    const machine = form.get("machineId");
    if (typeof machine === "string" && (uuidPattern.test(machine) || machine === legacyCardMachine)) params.set("maquininha", machine);
  }
  if (tab === "estoque") {
    const view = form.get("stockView");
    const search = form.get("stockSearch");
    if (typeof view === "string" && ["produtos", "lotes", "movimentacoes"].includes(view)) params.set("estoqueVisao", view);
    if (typeof search === "string" && search.trim()) params.set("busca", search.trim().slice(0, 100));
  }
  for (const key of ["inicio", "fim"]) {
    const date = form.get(key);
    if (typeof date === "string" && isCalendarDate(date)) params.set(key, date);
  }
  if (typeof filter === "string" && /^[a-z0-9-]{1,60}$/.test(filter)) params.set("loja", String(filter));
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
    params.set("ok", typeof message === "function" ? message() : message);
  } catch (error) {
    if (!(error instanceof RetailError)) console.error("Erro ao gravar operação MUVI-E", error instanceof Error ? error.name : "Erro");
    params.set("erro", error instanceof RetailError ? error.message : "Não foi possível salvar no banco local. Tente novamente.");
  }
  redirect("/admin?" + params);
}

function commit(form: FormData, tab: Tab, message: string, edit: (state: RetailState) => void) {
  return runAction(form, tab, message, (user) => editWithAudit(user, message, edit), tab === "produtos" || tab === "relatos" || tab === "catalogo");
}

function editWithAudit(user: User, action: string, edit: (state: RetailState) => void) {
  const event = { id: randomUUID(), actor: user.email, action, at: new Date().toISOString() };
  return editRetail((state) => {
    edit(state);
    state.audit = [event, ...state.audit].slice(0, 2000);
  });
}

function readLotColors(form: FormData) {
  const quantities = form.getAll("lotColorQuantity");
  return form.getAll("lotColor").map((value, index) => {
    const color = productColors.find((item) => item === value);
    const quantity = quantities[index];
    if ((!color && value !== "none") || typeof quantity !== "string" || !/^\d{1,6}$/.test(quantity)) {
      throw new RetailError("Confira a cor e a quantidade de cada linha.");
    }
    return { color, quantity: Number(quantity) };
  });
}

export async function savePurchaseColor(form: FormData) {
  await commit(form, "compras", "Cor do lote atualizada.", (state) => {
    setPurchaseLotColors(state, value(form, "focus", 36), readLotColors(form));
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
      specs: category === scooterCategory ? { ...readScooterSpecs(form), ...(current?.specs?.colors ? { colors: current.specs.colors } : {}) } : null,
      price: amount(form, "price"),
      purchaseCost: current?.purchaseCost ?? null,
      description: value(form, "description", 350, false),
      published: current?.published ?? false, imageUrl,
    };
    if (current) Object.assign(current, fields);
    else state.products.push({ id: newId, ...fields, stock: { "sao-jose": 0, palhoca: 0 } });
    });
  }, true);
}

export async function saveCardMachine(form: FormData) {
  const machineId = randomUUID();
  form.set("machineId", machineId);
  await commit(form, "taxas", "Maquininha cadastrada.", (state) => {
    const name = value(form, "name", 70);
    if (state.cardMachines.some((item) => item.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) {
      throw new RetailError("Já existe uma maquininha com esse nome.");
    }
    state.cardMachines.push({ id: machineId, name });
  });
}

export async function manageCardMachine(form: FormData) {
  const operation = form.get("operation");
  const remove = operation === "delete";
  const changeStatus = operation === "disable" || operation === "enable";
  const message = remove ? "Maquininha excluída." : changeStatus
    ? (operation === "disable" ? "Maquininha desativada." : "Maquininha reativada.") : "Nome da maquininha atualizado.";
  await runAction(form, "taxas", message, async (user) => {
    if (user.role !== "admin" && !isPrimaryAdmin(user)) throw new RetailError("Somente a Diretoria pode editar ou excluir maquininhas.");
    await editWithAudit(user, message, (state) => {
      const id = value(form, "machineId", 36);
      const machine = state.cardMachines.find((item) => item.id === id);
      const legacy = id === legacyCardMachine && state.cardRates.some((rate) => rateMachineId(rate) === id);
      if (!machine && !legacy) throw new RetailError("Maquininha não encontrada.");
      if (remove) {
        if (id === legacyCardMachine) throw new RetailError("Este grupo de taxas é gerenciado na edição de cada condição.");
        if (form.get("confirmed") !== "on") throw new RetailError("Confirme a exclusão da maquininha e das taxas.");
        state.cardMachines = state.cardMachines.filter((item) => item.id !== id);
        state.cardRates = state.cardRates.filter((rate) => rate.machineId !== id);
        return;
      }
      if (changeStatus) {
        if (machine) machine.inactive = operation === "disable";
        else state.cardMachines.push({ id, name: "Taxas anteriores", inactive: operation === "disable" });
        return;
      }
      const name = value(form, "name", 70);
      if (state.cardMachines.some((item) => item.id !== id && item.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) {
        throw new RetailError("Já existe uma maquininha com esse nome.");
      }
      if (machine) machine.name = name;
      else state.cardMachines.push({ id, name });
    });
  });
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
    const machine = value(form, "machineId", 36);
    const legacy = machine === legacyCardMachine && (!current || !current.machineId);
    if (!legacy && !state.cardMachines.some((item) => item.id === machine)) throw new RetailError("Selecione uma maquininha cadastrada.");
    const fields = { name: value(form, "name", 70), mode, installments, basisPoints, machineId: legacy ? undefined : machine };
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

export async function saveTradeInSale(form: FormData) {
  await commit(form, "bens", "Bem vendido e entrada registrada no caixa da unidade.", (state) => {
    sellTradeInAsset(state, value(form, "assetId", 100), amount(form, "amount"), requiredDate(form, "date"));
  });
}

export async function returnConsignment(form: FormData) {
  const createdAt = new Date().toISOString();
  await runAction(form, "consignados", "Devolução consignada registrada.", async (user) => {
    if (!isDirector(user)) throw new RetailError("Somente a Diretoria pode estornar consignados.");
    await editWithAudit(user, "Devolução consignada registrada.", (state) => {
      const id = value(form, "movementId", 36);
      if (!uuidPattern.test(id)) throw new RetailError("Atualize a página antes de registrar a devolução.");
      returnConsignedLot(state, { id, createdAt, purchaseId: value(form, "purchaseId"),
        productId: value(form, "productId"), store: choice(form, "store", storeIds(state)), quantity: units(form) });
    });
  });
}

export async function updateStock(form: FormData) {
  const id = randomUUID();
  const date = new Date().toISOString();
  await commit(form, "estoque", "Estoque atualizado.", (state) => {
    const mode = choice(form, "mode", ["saida", "transferencia"]);
    const product = value(form, "productId");
    const store = choice(form, "store", storeIds(state));
    const quantity = units(form);
    const origin = value(form, "stockOrigin", 140, false);
    if (mode === "transferencia") {
      transferStock(state, product, store, choice(form, "destination", storeIds(state)), quantity, id, date, origin || undefined);
    } else {
      const lot = origin ? stockLotForMovement(state, product, store, origin, quantity) : undefined;
      changeStock(state, product, store, -quantity, value(form, "reason", 100), id, date, lot?.purchaseId);
      if (lot) lot.quantity -= quantity;
    }
  });
}

export async function saveSale(form: FormData) {
  const newContactId = randomUUID();
  const createdAt = new Date().toISOString();
  let result: ReturnType<typeof submitStoreSale> = "registered";
  const message = () => result === "pending" ? "Venda enviada para aprovação da Diretoria." : "Venda registrada.";
  await runAction(form, "vendas", message, (user) => editWithAudit(user, "Envia venda para conferência de margem " + value(form, "saleId", 36), (state) => {
    const restricted = user.role === "sales";
    const id = value(form, "saleId", 36);
    if (!uuidPattern.test(id)) throw new RetailError("Reabra o formulário de venda.");
    if (state.sales.some((sale) => sale.id === id)) return;
    const store = choice(form, "store", storeIds(state));
    const mode = restricted ? choice(form, "customerMode", ["existing", "new"])
      : form.has("customerMode") ? choice(form, "customerMode", ["existing", "new", "walk-in"]) : "walk-in";
    let contactId = value(form, "contactId", 36, mode === "existing");
    const customer = mode === "existing" ? "" : value(form, "customer", 100, mode === "new");
    let contact: RetailState["contacts"][number] | undefined;
    if (mode === "new") {
      const { email, cpf } = contactIdentity(form, state);
      contactId = newContactId;
      contact = { id: contactId, name: customer, phone: value(form, "phone", 32, false), email, cpf,
        store, stage: "Ganho", interest: "", nextContact: "", notes: "", createdAt };
    }
    const defaultTax = restricted ? state.taxRates?.find((rate) => rate.defaultForSale) : undefined;
    if (restricted) {
      if (!defaultTax) throw new RetailError("Peça à Diretoria para cadastrar um imposto padrão de venda, inclusive se for 0%.");
      const customerRecord = contact ?? state.contacts.find((item) => item.id === contactId && item.store === store);
      if (!customerRecord?.name || !customerRecord.phone || !customerRecord.email || !customerRecord.cpf) {
        throw new RetailError("Preencha nome, telefone, e-mail e CPF do cliente antes de registrar a venda.");
      }
    }
    if (form.has("checkoutProduct")) {
      const products = form.getAll("checkoutProduct");
      const quantities = form.getAll("checkoutQuantity");
      const origins = form.getAll("checkoutOrigin");
      const overrides = form.getAll("checkoutCost");
      if ((restricted || !canAccess(user, "financeiro")) && overrides.some((item) => String(item).trim())) throw new RetailError("Sem permissão para editar custos.");
      const kinds = form.getAll("checkoutKind");
      if (restricted && (kinds.length !== products.length || kinds.some((kind) => kind !== "sale" && kind !== "gift"))) {
        throw new RetailError("Selecione o tipo de cada item da venda.");
      }
      const methods = form.getAll("checkoutMethod");
      const assets = form.getAll("checkoutAsset");
      const amounts = form.getAll("checkoutAmount");
      const rates = form.getAll("checkoutRate");
      const machines = form.getAll("checkoutMachine");
      const statuses = form.getAll("checkoutStatus");
      const dates = form.getAll("checkoutDue");
      const manualTax = !restricted && form.get("taxMode") === "manual" ? value(form, "manualTax", 32) : undefined;
      result = submitStoreSale(state, { contact, requestedBy: user.email, checkout: { id, store, customer, contactId, createdAt, discount: amount(form, "discount"),
        sellerId: value(form, "sellerId", 36, restricted), reconcileCards: restricted,
        taxRateId: restricted ? defaultTax?.id : value(form, "taxRateId", 36, false),
        manualTax: manualTax === undefined ? undefined : amount(form, "manualTax"),
        items: products.map((productId, index) => ({ productId: String(productId), quantity: Number(quantities[index]),
          origin: String(origins[index] ?? ""), gift: kinds[index] === "gift",
          unitCostOverride: String(overrides[index] ?? "").trim() ? parseReais(String(overrides[index])) ?? -1 : undefined })),
        payments: methods.flatMap((method, index) => {
          const matched = paymentMethods.find((item) => item === method);
          const paid = parseReais(String(amounts[index] ?? ""));
          if (!matched || paid === null) throw new RetailError("Confira os pagamentos da venda.");
          if (!restricted && methods.length === 1 && paid === 0) return [];
          if (matched === "Cartão" && !state.cardRates.some((rate) => rate.id === rates[index] && rateMachineId(rate) === machines[index] && cardMachineIsActive(state.cardMachines, rateMachineId(rate)))) {
            throw new RetailError("Selecione uma maquininha ativa e uma taxa cadastrada nela.");
          }
          if (restricted && (paid <= 0 || !["received", "pending"].includes(String(statuses[index])) ||
            (matched === "Cartão" && statuses[index] !== "pending") || (matched === "Produto" && !String(assets[index] ?? "").trim()))) {
            throw new RetailError("Preencha a forma, o valor e os dados de cada pagamento. Cartão deve ficar a receber até a conciliação.");
          }
          return [{ method: matched, amount: paid, assetDescription: matched === "Produto" ? String(assets[index] ?? "").trim().slice(0, 120) : undefined, rateId: String(rates[index] ?? ""),
            received: statuses[index] === "received", due: String(dates[index] ?? "") }];
        }),
      } }, restricted);
      return;
    }
    throw new RetailError("Reabra a página para registrar a venda com lotes de compra.");
  }));
}

export async function reviewSaleApproval(form: FormData) {
  const approve = form.get("decision") === "approve";
  await runAction(form, "vendas", approve ? "Venda aprovada e registrada." : "Solicitação recusada.", async (user) => {
    if (!isDirector(user)) throw new RetailError("Somente a Diretoria pode decidir sobre a aprovação.");
    const id = value(form, "requestId", 36);
    if (form.get("decision") !== "approve" && form.get("decision") !== "reject") throw new RetailError("Selecione uma decisão válida.");
    await editWithAudit(user, (approve ? "Aprova venda " : "Recusa venda ") + id, (state) => reviewStoreSale(state, id, approve));
  });
}

export async function saveSupplier(form: FormData) {
  const newId = randomUUID();
  await commit(form, "fornecedores", "Fornecedor salvo.", (state) => {
    const id = value(form, "id", 36, false);
    saveSupplierRecord(state, { id: id || newId, name: value(form, "name", 100),
      cnpj: value(form, "cnpj", 24, false), location: value(form, "location", 180, false),
      phone: value(form, "phone", 32, false), email: value(form, "email", 254, false),
      notes: value(form, "notes", 500, false) }, Boolean(id));
  });
}

export async function savePurchase(form: FormData) {
  const createdAt = new Date().toISOString();
  await runAction(form, "compras", "Compra registrada e estoque atualizado.", async (user) => {
    await editWithAudit(user, "Compra registrada e estoque atualizado.", (state) => {
      const id = value(form, "purchaseId", 36);
      if (!uuidPattern.test(id)) throw new RetailError("Reabra o formulário de compra.");
      const date = value(form, "date", 10);
      if (!isCalendarDate(date) || date > localToday()) throw new RetailError("Informe uma data de compra válida, até hoje.");
      if (state.purchases.some((purchase) => purchase.id === id)) return;
      const lotColors = readLotColors(form);
      let productId = value(form, "productId");
      if (productId === "new") {
        if (!canAccess(user, "produtos")) throw new RetailError("Sua conta não tem acesso ao cadastro de produtos.");
        if (form.get("openingBalance") === "on") throw new RetailError("Para um produto novo, registre uma entrada normal.");
        const sku = value(form, "sku", 40).toUpperCase();
        if (state.products.some((item) => item.sku === sku)) throw new RetailError("Já existe um produto com este SKU. Selecione-o na compra.");
        const category = choice(form, "category", productCategories);
        productId = randomUUID();
        state.products.push({
          id: productId, sku, name: value(form, "name", 100), category, price: amount(form, "price"),
          specs: category === scooterCategory ? readScooterSpecs(form) : null,
          description: "", imageUrl: "", published: false, stock: {},
        });
      }
      const supplierChoice = value(form, "supplierId", 36, false);
      const supplier = supplierChoice === "new"
        ? saveSupplierRecord(state, { id: randomUUID(), name: value(form, "supplierName", 100),
          cnpj: value(form, "supplierCnpj", 24, false), location: value(form, "supplierLocation", 180, false) })
        : state.suppliers.find((item) => item.id === supplierChoice);
      if (supplierChoice && !supplier) throw new RetailError("Selecione um fornecedor cadastrado.");
      const product = state.products.find((item) => item.id === productId);
      recordPurchase(state, {
        id, date, lotColors, createdAt, openingBalance: form.get("openingBalance") === "on", store: choice(form, "store", storeIds(state)), productId,
        ...(product?.category === scooterCategory && { specs: readScooterSpecs(form) }),
        supplier: supplier?.name ?? "", supplierId: supplier?.id, contactId: value(form, "contactId", 36, false),
        quantity: units(form), unitCost: amount(form, "unitCost"),
        invoiceNumber: value(form, "invoiceNumber", 44, false), notes: value(form, "notes", 500, false),
        acquisition: form.has("acquisition") ? choice(form, "acquisition", acquisitionTypes) : undefined,
        due: value(form, "due", 10, false),
      });
    });
  });
}

export async function attachInvoice(form: FormData) {
  const owner = form.get("owner");
  const tab = invoiceModule[invoiceOwners.find((item) => item === owner) ?? "client"];
  await runAction(form, tab, "Nota fiscal anexada.", async (user) => {
    const type = choice(form, "owner", invoiceOwners);
    const ownerId = value(form, "ownerId", 36);
    const kind = type === "purchase" || type === "asset" ? "Compra" : type === "sale" ? "Venda" : choice(form, "kind", invoiceKinds);
    const file = form.get("invoice");
    if (!(file instanceof File)) throw new RetailError("Selecione um arquivo em PDF ou XML.");
    const state = await readRetail();
    const owners = type === "purchase" ? state.purchases : type === "sale" ? state.sales : type === "asset" ? state.assets : state.contacts;
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
  const requestedId = form.get("assetId");
  const assetId = typeof requestedId === "string" && uuidPattern.test(requestedId) ? requestedId : randomUUID();
  const newId = form.get("assetPage") === "1" ? assetId : randomUUID();
  const tab = form.get("assetPage") === "1" ? "bens" : form.get("staffPage") === "1" ? "funcionarios" : "lojas";
  const message = tab === "bens" ? "Bem salvo." : "Cadastro da unidade atualizado.";
  if (tab === "bens" && !form.get("id") && form.get("invoice") instanceof File) form.set("focus", newId);
  await runAction(form, tab, message, async (user) => {
    const file = form.get("invoice");
    const persist = tab === "bens" && !form.get("id") && file instanceof File && file.size
      ? await prepareInvoice("asset", newId, "Compra", file) : undefined;
    await editWithAudit(user, message, (state) => {
      const store = choice(form, "store", storeIds(state));
      const kind = choice(form, "kind", ["staff", "fixed", "asset"]);
      if (tab === "bens" && kind !== "asset") throw new RetailError("Selecione um bem de estrutura.");
      if (tab === "funcionarios" && kind !== "staff") throw new RetailError("Selecione um cadastro de funcionário.");
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
        const acquiredOn = tab === "bens" ? value(form, "acquiredOn", 10, !id) : "";
        if (acquiredOn && (!isCalendarDate(acquiredOn) || acquiredOn > localToday())) throw new RetailError("Informe uma data de aquisição válida, até hoje.");
        const item = { ...fields, quantity: units(form), amount: amount(form, "amount"), notes: value(form, "notes", 500, false),
          ...(acquiredOn ? { acquiredOn } : {}) };
        const existing = state.assets.find((row) => row.id === id && (tab === "bens" || row.store === store));
        if (id && !existing) throw new RetailError("Item de estrutura não encontrado nesta unidade.");
        if (existing) Object.assign(existing, item);
        else {
          if (state.assets.some((row) => row.id === newId)) throw new RetailError("Este bem já foi salvo. Use Ver detalhes e editar para anexar o comprovante.");
          state.assets.push(item);
        }
      }
    });
    if (persist) {
      try {
        await persist();
      } catch {
        throw new RetailError("O bem foi salvo. O comprovante não foi anexado. Tente novamente em Ver detalhes e editar.");
      }
    }
  });
}

export async function launchMonth(form: FormData) {
  await commit(form, "lojas", "Custos fixos e salários do mês lançados. Lançamentos existentes foram preservados.", (state) => {
    const month = value(form, "month", 7);
    postMonthlyCosts(state, choice(form, "store", storeIds(state)), month);
  });
}

export async function saveProfitDistribution(form: FormData) {
  await runAction(form, "distribuicoes", "Distribuição de lucro registrada.", async (actor) => {
    const id = value(form, "entryId", 36);
    if (!uuidPattern.test(id)) throw new RetailError("Reabra o formulário.");
    const email = value(form, "beneficiaryEmail", 254);
    const db = await getMongoDb();
    const recipient = await db.collection<User>("users").findOne({ email }, { projection: { name: 1, role: 1, managed: 1, disabled: 1 } });
    if (!recipient || recipient.disabled || !isDirector(recipient)) throw new RetailError("Selecione um usuário ativo da Diretoria.");
    await editWithAudit(actor, "Distribuição de lucro registrada.", (state) => {
      recordProfitDistribution(state, {
        id, store: choice(form, "store", storeIds(state)), beneficiary: recipient.name, beneficiaryEmail: email,
        amount: amount(form, "amount"), date: requiredDate(form, "date"),
      });
    });
  });
}

export async function saveLedgerEntry(form: FormData) {
  await commit(form, "compromissos", "Compromisso lançado.", (state) => {
    const id = value(form, "entryId", 36);
    if (!uuidPattern.test(id)) throw new RetailError("Reabra o formulário.");
    if (state.ledger.some((item) => item.id === id)) return;
    const direction = choice(form, "direction", ["in", "out"]);
    const classification = form.has("classification") ? choice(form, "classification", ["operacional", "somente-caixa"]) : "operacional";
    const date = requiredDate(form, "date", true);
    const due = requiredDate(form, "due", true);
    const total = amount(form, "amount");
    if (total <= 0 || due < date) throw new RetailError("Informe valor positivo e vencimento a partir da data do lançamento.");
    const frequency = choice(form, "frequency", ["fixed", "monthly", "standalone"]);
    const fixed = frequency === "fixed";
    const duration = fixed ? value(form, "repeatMonths", 3, false) : "";
    const months = duration ? Number(duration) : undefined;
    if (months !== undefined && (!/^\d+$/.test(duration) || !Number.isInteger(months) || months < 1 || months > 120)) {
      throw new RetailError("Informe entre 1 e 120 meses ou deixe em branco para repetir até encerrar.");
    }
    state.ledger.unshift({ id, store: choice(form, "store", storeIds(state)), name: value(form, "name", 120),
      direction, kind: classification === "somente-caixa" ? "ajuste" : direction === "in" ? "outra-receita" : "despesa",
      amount: total, date, due, settlements: [], manual: true, ...(fixed ? { recurrence: { months, due } } : { frequency }) });
  });
}

export async function updateLedger(form: FormData) {
  const paymentId = randomUUID();
  await commit(form, "compromissos", "Compromisso atualizado.", (state) => {
    const id = value(form, "id");
    const mode = choice(form, "mode", ["pay", "reverse", "schedule", "cancel", "end-recurrence"]);
    const entry = state.ledger.find((item) => item.id === id && (!item.canceled || mode === "end-recurrence"));
    if (!entry) throw new RetailError("Compromisso indisponível.");
    if (mode === "end-recurrence") {
      const template = entry.recurringFrom ? state.ledger.find((item) => item.id === entry.recurringFrom) : entry;
      if (!template?.recurrence) throw new RetailError("Compromisso sem recorrência.");
      template.recurrence.endedOn ??= localToday();
      return;
    }
    if (mode === "cancel") {
      if (form.get("confirmed") !== "on") throw new RetailError("Confirme o cancelamento do compromisso.");
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

function contactIdentity(form: FormData, state: RetailState, id = "") {
  const email = value(form, "email", 254, false);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RetailError("Informe um e-mail válido.");
  const cpf = normalizeCpf(value(form, "cpf", 20, false));
  if (cpf && state.contacts.some((item) => item.id !== id && item.cpf === cpf)) throw new RetailError("Este CPF já está cadastrado em outro cliente.");
  return { email, cpf };
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
    const { email, cpf } = contactIdentity(form, state, id);
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
      store: choice(form, "store", storeIds(state)), stage: choice(form, "stage", stages),
      interest: value(form, "interest", 100, false), nextContact, notes: value(form, "notes", 500, false),
    };
    if (contact) Object.assign(contact, fields);
    else state.contacts.unshift({ id: newId, ...fields, createdAt });
  });
}


export async function saveUnit(form: FormData) {
  const id = randomUUID();
  await commit(form, "lojas", "Unidade adicionada.", (state) => {
    const name = value(form, "name", 70);
    const code = value(form, "code", 8).toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(code)) throw new RetailError("Use uma sigla de 2 a 8 letras ou números.");
    if (storeList(state).some((unit) => unit.code === code || unit.name.localeCompare(name, "pt-BR", { sensitivity: "base" }) === 0)) {
      throw new RetailError("Já existe uma unidade com esse nome ou sigla.");
    }
    (state.units ??= []).push({ id, name, code });
  });
}

export async function savePublication(form: FormData) {
  await commit(form, "catalogo", "Publicação atualizada.", (state) => {
    const id = value(form, "id", 140);
    const product = state.products.find((item) => item.id === id);
    if (!product || !["Scooter elétrica", "Bicicleta elétrica"].includes(product.category)) throw new RetailError("Modelo não encontrado.");
    product.published = form.get("published") === "on";
  });
}

export async function saveStaffAdvance(form: FormData) {
  await commit(form, "funcionarios", "Vale registrado.", (state) => {
    const id = value(form, "advanceId", 36);
    if (!uuidPattern.test(id)) throw new RetailError("Reabra o formulário de vale.");
    const advances = state.staffAdvances ??= [];
    if (advances.some((item) => item.id === id)) return;
    const staffId = value(form, "staffId", 36);
    const employee = state.staff.find((item) => item.id === staffId && item.active);
    if (!employee) throw new RetailError("Selecione um funcionário ativo.");
    const date = value(form, "date", 10);
    const total = amount(form, "amount");
    if (!isCalendarDate(date) || date > localToday() || total <= 0) throw new RetailError("Informe uma data válida e um valor positivo.");
    advances.unshift({ id, staffId, store: employee.store, date, amount: total, notes: value(form, "notes", 300, false) });
  });
}

export async function saveSaleFiscalNotes(form: FormData) {
  await commit(form, "vendas", "Informações fiscais salvas.", (state) => {
    const id = value(form, "focus", 36);
    const sale = state.sales.find((item) => item.id === id && !item.canceledAt);
    if (!sale) throw new RetailError("Venda ativa não encontrada.");
    sale.fiscalNotes = value(form, "fiscalNotes", 1500, false);
  });
}


export async function saveTaxRate(form: FormData) {
  const newId = randomUUID();
  await commit(form, "impostos", "Imposto salvo.", (state) => {
    const id = value(form, "id", 36, false);
    const rates = state.taxRates ??= [];
    const current = rates.find((item) => item.id === id);
    if (id && !current) throw new RetailError("Imposto não encontrado.");
    const name = value(form, "name", 70);
    value(form, "percent", 8);
    const basisPoints = amount(form, "percent");
    if (basisPoints > 10000) throw new RetailError("Informe uma alíquota de até 100%.");
    const defaultForSale = form.get("defaultForSale") === "on";
    if (defaultForSale) for (const rate of rates) rate.defaultForSale = false;
    const fields = { name, basisPoints, defaultForSale };
    if (current) Object.assign(current, fields);
    else rates.push({ id: newId, ...fields });
  });
}

export async function reversePurchase(form: FormData) {
  const canceledAt = new Date().toISOString();
  await runAction(form, "compras", "Compra cancelada.", async (user) => {
    if (user.role !== "admin" && !isPrimaryAdmin(user)) throw new RetailError("Somente a Diretoria pode cancelar compras.");
    await editWithAudit(user, "Compra cancelada.", (state) => {
      cancelPurchase(state, value(form, "focus", 36), canceledAt, form.get("paymentReversed") === "on");
    });
  });
}

export async function savePurchaseCost(form: FormData) {
  await commit(form, "compras", "Custo da compra atualizado.", (state) => {
    updatePurchaseCost(state, value(form, "focus", 36), amount(form, "unitCost"));
  });
}

export async function saveSaleCosts(form: FormData) {
  await runAction(form, "vendas", "Custos da venda atualizados.", async (user) => {
    if (user.role !== "admin" && !isPrimaryAdmin(user)) throw new RetailError("Sem permissão para editar custos.");
    await editWithAudit(user, "Custos da venda atualizados.", (state) => {
      const readAmount = (amount: FormDataEntryValue | null) => typeof amount === "string" && amount.trim() ? parseReais(amount) ?? -1 : -1;
      const id = value(form, "focus", 36);
      updateSaleCosts(state, id, {
        costs: form.getAll("lineCost").map((item) => item === "" ? null : readAmount(item)),
        commission: readAmount(form.get("commission")),
        tax: readAmount(form.get("tax")),
        cardFees: form.getAll("cardFee").map(readAmount),
      });
      const sale = state.sales.find((item) => item.id === id);
      const profit = sale && saleNetProfit(sale);
      if (sale?.sellerMarginRestricted && typeof profit === "number" && profit < sellerMinimumProfit && form.get("confirmLowMargin") !== "on") {
        throw new RetailError("Confirme que a Diretoria aprova a margem final abaixo de R$ 1.000.");
      }
    });
  });
}

function signedCashAmount(form: FormData, key: string) {
  const raw = value(form, key, 32);
  const negative = raw.startsWith("-");
  const cents = parseReais(negative ? raw.slice(1) : raw);
  if (cents === null) throw new RetailError("Informe um saldo válido em reais.");
  return negative ? -cents : cents;
}

export async function saveCashAccount(form: FormData) {
  const id = randomUUID();
  await commit(form, "caixa", "Conta cadastrada.", (state) => {
    const store = choice(form, "store", storeIds(state));
    const openingDate = requiredDate(form, "openingDate");
    const name = value(form, "name", 80);
    const kind = choice(form, "kind", ["Banco", "Dinheiro"]);
    const method = form.get("paymentMethod") ? choice(form, "paymentMethod", ["Pix", "Cartão", "Dinheiro", "Financiamento"]) : undefined;
    const accounts = state.cashAccounts ??= [];
    if (accounts.some((account) => account.store === store && account.name.toLowerCase() === name.toLowerCase())) {
      throw new RetailError("Já existe uma conta com esse nome nesta unidade.");
    }
    if (method && accounts.some((account) => account.store === store && account.paymentMethod === method)) {
      throw new RetailError("Esta forma de pagamento já tem uma conta automática nesta unidade.");
    }
    const reviewDays = Number(value(form, "reviewDays", 3));
    if (!Number.isInteger(reviewDays) || reviewDays < 1 || reviewDays > 365) throw new RetailError("Informe um intervalo de conferência entre 1 e 365 dias.");
    accounts.push({ id, store, name, kind, openingDate, paymentMethod: method, reviewDays, openingBalance: signedCashAmount(form, "openingBalance"),
      defaultAccount: !accounts.some((account) => account.store === store) });
  });
}

export async function assignCashMovement(form: FormData) {
  await commit(form, "caixa", "Conta do movimento atualizada.", (state) => {
    const entryId = value(form, "entryId", 180);
    const settlementId = value(form, "settlementId", 180);
    const accountId = value(form, "accountId", 36);
    const entry = state.ledger.find((row) => row.id === entryId);
    const payment = entry?.settlements.find((row) => row.id === settlementId);
    const account = state.cashAccounts?.find((row) => row.id === accountId);
    if (!entry || entry.nonCash || !payment || !account || account.store !== entry.store || payment.date < account.openingDate) {
      throw new RetailError("Selecione uma conta da mesma unidade, aberta na data da baixa.");
    }
    state.cashAssignments = (state.cashAssignments ?? []).filter((row) => row.entryId !== entryId || row.settlementId !== settlementId);
    state.cashAssignments.push({ entryId, settlementId, accountId });
  });
}

export async function reconcileCashAccount(form: FormData) {
  const id = randomUUID();
  await runAction(form, "caixa", "Conferência de extrato registrada.", async (user) => {
    const accountId = value(form, "accountId", 36);
    const date = requiredDate(form, "date");
    const statementBalance = signedCashAmount(form, "statementBalance");
    const notes = value(form, "notes", 500, false);
    const file = form.get("statement");
    const findAccount = (state: RetailState) => {
      const account = state.cashAccounts?.find((row) => row.id === accountId);
      if (!account || date < account.openingDate) throw new RetailError("Selecione uma conta aberta na data da conferência.");
      return account;
    };
    let statementName: string | undefined;
    if (file instanceof File && (file.size || file.name)) {
      findAccount(await readRetail());
      statementName = await saveCashStatement(id, file);
    }
    await editWithAudit(user, "Confere extrato de Caixa", (state) => {
      const systemBalance = cashBalance(findAccount(state), cashMovements(state), date);
      (state.cashReconciliations ??= []).unshift({ id, accountId, date, statementBalance, systemBalance,
        notes, actor: user.email, ...(statementName && { statementName }) });
    });
  });
}

export async function recordCashAdjustment(form: FormData) {
  const id = randomUUID();
  await commit(form, "caixa", "Movimento avulso registrado.", (state) => {
    const account = state.cashAccounts?.find((row) => row.id === value(form, "accountId", 36));
    const date = requiredDate(form, "date");
    if (!account || date < account.openingDate) throw new RetailError("Selecione uma conta aberta na data do movimento.");
    const direction = choice(form, "direction", ["in", "out"]);
    const total = amount(form, "amount");
    if (total <= 0) throw new RetailError("Informe um valor maior que zero.");
    const settlementId = id + "-paid";
    state.ledger.unshift({ id, store: account.store, kind: "ajuste", direction, name: value(form, "name", 120),
      amount: total, date, due: date, settlements: [{ id: settlementId, amount: total, date }] });
    (state.cashAssignments ??= []).push({ entryId: id, settlementId, accountId: account.id });
  });
}

export async function saveHistoricalPayments(form: FormData) {
  await runAction(form, "vendas", "Pagamentos históricos corrigidos.", async (user) => {
    if (!isDirector(user)) throw new RetailError("Somente a Diretoria pode corrigir pagamentos antigos.");
    await editWithAudit(user, "Corrige pagamentos históricos da venda " + value(form, "focus", 36), (state) => {
      const id = value(form, "focus", 36);
      const count = Number(value(form, "historyCount", 2));
      if (!Number.isInteger(count) || count < 1 || count > 30 || form.get("confirmed") !== "on") {
        throw new RetailError("Confira as formas de pagamento e confirme a correção.");
      }
      correctHistoricalPayments(state, id, Array.from({ length: count }, (_, index) => {
        const method = choice(form, "historyMethod" + index, paymentMethods);
        return {
          method,
          amount: amount(form, "historyAmount" + index),
          fee: method === "Cartão" ? amount(form, "historyFee" + index) : 0,
          status: choice(form, "historyStatus" + index, ["received", "pending"]),
          date: value(form, "historyDate" + index, 10),
          assetDescription: value(form, "historyAsset" + index, 140, false),
          source: value(form, "historySource" + index, 180, false),
        };
      }), localToday());
    });
  });
}

export async function saveHistoricalPurchasePayment(form: FormData) {
  await runAction(form, "compras", "Pagamento histórico registrado no caixa.", async (user) => {
    if (!isDirector(user)) throw new RetailError("Somente a Diretoria pode regularizar pagamentos antigos.");
    await editWithAudit(user, "Registra pagamento histórico da compra " + value(form, "focus", 36), (state) => {
      if (form.get("confirmed") !== "on") throw new RetailError("Confirme que a compra já foi paga.");
      registerHistoricalPurchasePayment(state, value(form, "focus", 36), requiredDate(form, "paidOn"), localToday());
    });
  });
}

export async function importContract(form: FormData) {
  await runAction(form, "contratos", "PDF importado e disponível para a equipe.", async (user) => {
    if (!isDirector(user)) throw new RetailError("Somente a Diretoria pode importar contratos.");
    const file = form.get("contract");
    if (!(file instanceof File)) throw new RetailError("Selecione o PDF do contrato.");
    await storeContract(file, value(form, "title", 120, false));
  });
}

export async function saveCardReceipt(form: FormData) {
  await runAction(form, "caixa", "Recebimento de cartão registrado.", (user) => {
    if (user.role === "sales") throw new RetailError("A conciliação de cartão é feita pelo Financeiro ou pela Diretoria.");
    return editWithAudit(user, "Registra crédito de cartão", (state) => {
      const mode = choice(form, "mode", ["expected", "partial", "close"]);
      const token = value(form, "token", 36);
      if (mode !== "expected") value(form, "amount", 32);
      if (!uuidPattern.test(token)) throw new RetailError("Reabra a conciliação para registrar o crédito.");
      reconcileCardReceipt(state, value(form, "entryId", 180), {
        token, date: requiredDate(form, "date"), complete: mode !== "partial",
        amount: mode === "expected" ? undefined : amount(form, "amount"),
        accountId: value(form, "accountId", 36),
      });
    });
  });
}

export async function reverseCardReceipt(form: FormData) {
  await runAction(form, "caixa", "Crédito de cartão estornado.", (user) => {
    if (user.role === "sales") throw new RetailError("A conciliação de cartão é feita pelo Financeiro ou pela Diretoria.");
    return editWithAudit(user, "Estorna crédito de cartão", (state) => {
      const entryId = value(form, "entryId", 180);
      const paymentId = value(form, "paymentId", 180);
      const row = cardReceivables(state).find(({ entry }) => entry.id === entryId);
      if (!row?.entry.settlements.some((payment) => payment.id === paymentId && payment.cashAmount !== undefined && !payment.reversedOn)) {
        throw new RetailError("Crédito de cartão indisponível para estorno.");
      }
      reverseSettlement(state, entryId, paymentId, requiredDate(form, "date"));
    });
  });
}

export async function removeProduct(form: FormData) {
  await runAction(form, "produtos", "Produto excluído.", async (user) => {
    if (!isDirector(user)) throw new RetailError("Somente a Diretoria pode excluir produtos.");
    const id = value(form, "focus", 36);
    if (form.get("confirmed") !== "on") throw new RetailError("Confirme a exclusão do produto.");
    await editWithAudit(user, "Exclui produto " + id, (state) => deleteProduct(state, id));
  }, true);
}
