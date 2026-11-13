export const modules = {
  visao: "Visão geral", produtos: "Produtos", estoque: "Estoque", compras: "Compras",
  vendas: "Vendas", financeiro: "Financeiro", lojas: "Administração das lojas", crm: "Clientes / CRM",
  simulador: "Simular venda", taxas: "Taxas de cartão", usuarios: "Usuários", logs: "Log de ações",
  funcionarios: "Funcionários", relatos: "Relatos da landing", consignados: "Consignados", catalogo: "Catálogo do site",
} as const;
export type Module = keyof typeof modules;
export const moduleKeys = Object.keys(modules) as Module[];

export const roles = {
  admin: "Diretoria", sales: "Vendedor", finance: "Financeiro", inventory: "Estoque e compras", staff: "Atendimento",
} as const;
export type Role = keyof typeof roles;
export type AccountAccess = { role?: Role; permissions?: Module[] | null; managed?: boolean };

const defaults: Record<Role, readonly Module[]> = {
  admin: moduleKeys,
  sales: ["visao", "estoque", "vendas", "crm", "simulador"],
  finance: ["visao", "compras", "vendas", "financeiro", "taxas", "consignados"],
  inventory: ["produtos", "estoque", "compras", "consignados"],
  staff: ["visao", "produtos", "estoque", "compras", "vendas", "crm", "simulador"],
};

export function isPrimaryAdmin(account: AccountAccess) {
  return !account.managed && (!account.role || account.role === "admin");
}

export function accessFor(account: AccountAccess, role = account.role ?? "admin"): Module[] {
  if (isPrimaryAdmin(account)) return [...moduleKeys];
  const chosen = Array.isArray(account.permissions) ? account.permissions : defaults[role] ?? [];
  return moduleKeys.filter((key) => chosen.includes(key) && (key !== "usuarios" || role === "admin"));
}

export const canAccess = (account: AccountAccess, module: Module) => accessFor(account).includes(module);
export const invoiceModule = { purchase: "compras", sale: "vendas", client: "crm" } as const;
