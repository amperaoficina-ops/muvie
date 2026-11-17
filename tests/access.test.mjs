import assert from "node:assert/strict";
import test from "node:test";
import { accessFor, canAccess, overviewAccess, invoiceModule, isPrimaryAdmin, moduleKeys } from "../domain/access.ts";

test("contas existentes preservam o administrador principal e o perfil de atendimento", () => {
  assert.equal(isPrimaryAdmin({}), true);
  assert.equal(isPrimaryAdmin({ role: "admin", managed: true }), false);
  assert.deepEqual(accessFor({}), moduleKeys);
  assert.equal(canAccess({ role: "staff" }, "compras"), true);
  assert.equal(canAccess({ role: "staff" }, "financeiro"), false);
});

test("permissões personalizadas substituem o cargo e gestão de usuários é exclusiva de administradores", () => {
  assert.equal(canAccess({ role: "sales" }, "vendas"), true);
  assert.equal(canAccess({ role: "finance" }, "financeiro"), true);
  assert.equal(canAccess({ role: "inventory" }, "estoque"), true);
  const user = { role: "sales", managed: true, permissions: ["estoque", "usuarios", "financeiro"] };
  assert.deepEqual(accessFor(user), ["estoque", "financeiro"]);
  assert.equal(canAccess(user, invoiceModule.sale), false);
  assert.equal(canAccess({ role: "admin", managed: true, permissions: ["visao"] }, "usuarios"), false);
});

test("Visão geral exige acesso independente para cada conjunto de dados", () => {
  assert.deepEqual(overviewAccess({ role: "sales", managed: true, permissions: ["visao"] }), {
    sales: false, finance: false, inventory: false, purchases: false, crm: false, staff: false, assets: false,
  });
  assert.deepEqual(overviewAccess({ role: "staff", managed: true, permissions: ["visao", "crm", "estoque"] }), {
    sales: false, finance: false, inventory: true, purchases: false, crm: true, staff: false, assets: false,
  });
});
