export const modules = {
  visao: "Visão geral", produtos: "Produtos", estoque: "Estoque", compras: "Compras",
  vendas: "Vendas", contratos: "Contratos", financeiro: "Financeiro", caixa: "Caixa", compromissos: "Compromissos", distribuicoes: "Distribuição de lucro", lojas: "Administração das lojas", crm: "Clientes / CRM",
  simulador: "Simular venda", taxas: "Taxas e maquininhas", impostos: "Impostos", usuarios: "Usuários", logs: "Log de ações",
  bens: "Bens", fornecedores: "Fornecedores", funcionarios: "Funcionários", relatos: "Relatos da landing", consignados: "Consignados", catalogo: "Catálogo do site",
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
  sales: ["visao", "estoque", "vendas", "contratos", "crm", "simulador"],
  finance: ["visao", "bens", "compras", "fornecedores", "vendas", "financeiro", "caixa", "compromissos", "distribuicoes", "taxas", "impostos", "consignados"],
  inventory: ["produtos", "estoque", "compras", "fornecedores", "consignados"],
  staff: ["visao", "produtos", "estoque", "compras", "vendas", "contratos", "crm", "simulador"],
};

export function isPrimaryAdmin(account: AccountAccess) {
  return !account.managed && (!account.role || account.role === "admin");
}

export function isDirector(account: AccountAccess) {
  return account.role === "admin" || isPrimaryAdmin(account);
}

export function accessFor(account: AccountAccess, role = account.role ?? "admin"): Module[] {
  if (isPrimaryAdmin(account)) return [...moduleKeys];
  const chosen = Array.isArray(account.permissions) ? account.permissions : defaults[role] ?? [];
  return moduleKeys.filter((key) => chosen.includes(key) && (key !== "usuarios" || role === "admin"));
}

export const canAccess = (account: AccountAccess, module: Module) => accessFor(account).includes(module);
export function overviewAccess(account: AccountAccess) {
  return {
    sales: canAccess(account, "vendas"), finance: canAccess(account, "financeiro"),
    inventory: canAccess(account, "estoque"), purchases: canAccess(account, "compras"),
    crm: canAccess(account, "crm"), staff: canAccess(account, "funcionarios"), assets: canAccess(account, "bens"),
  };
}

export const invoiceModule = { purchase: "compras", sale: "vendas", client: "crm", asset: "bens" } as const;
