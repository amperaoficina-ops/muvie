import { LotColorField, ProductColorsField } from "./product-color-fields";
import { ModelCard } from "../catalog";
import { SupplierField } from "./supplier-field";
import { SearchSelect } from "./search-select";
import { TaxSettings } from "./tax-settings";
import { CheckoutFields } from "./checkout-fields";
import { CreateDialog, DetailsDialog } from "./sale-dialog";
import { AttachmentPicker } from "./attachment-picker";
import { MobileMenu } from "./mobile-menu";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import Image from "next/image";
import { Brand, Icon } from "../brand";
import { SignOutDialog } from "./sign-out-dialog";
import { requireUser, type User } from "@/lib/auth";
import { getMongoDb } from "@/lib/mongodb";
import { listInvoices, type InvoiceMeta, type InvoiceOwner } from "@/lib/invoices";
import { readRetail } from "@/lib/retail-store";
import {
  balanceDue, isCalendarDate, money, saleNetProfit, tradeInAssets, productColorAvailability, productColorStock, productCategories, stages, stockComposition, storeName, storeList,
  type Asset, type Contact, type Supplier, type Product, type RetailState, type Sale, type Store, type StoreId,
} from "@/domain/retail";
import { attachInvoice, reversePurchase, reverseSale, saveContact, saveProduct, savePurchase, saveSale, updateStock, savePublication, saveSaleFiscalNotes, savePurchaseCost, savePurchaseColor, saveSaleCosts, returnConsignment, saveSupplier, saveTradeInSale, saveStoreItem, saveProfitDistribution } from "./actions";
import { scooterFields } from "@/domain/scooter";
import { ProductCategoryFields, PurchaseProductFields } from "./scooter-fields";
import { SaleCustomer } from "./sale-customer";
import { StaffPanel } from "./staff";
import { StockFields } from "./stock-fields";
import { InventoryOverview, InvoiceOverview } from "./inventory-overview";
import { UnitDialog } from "./unit-dialog";
import { Submit } from "./submit";
import { CardSettings, Charts, TestimonialsSettings, UsersPanel } from "./operations";
import { RecordSearch } from "./record-search";
import { Simulator } from "./simulator";
import { Commitments, Finance, Rankings, reportPeriod, StoresPanel } from "./finance";
import { isPrimaryAdmin, canAccess } from "@/domain/access";

const nav = [
  { id: "visao", label: "Visão geral", icon: "grid", description: "Acompanhe o estoque, as vendas e os atendimentos das suas lojas." },
  { id: "produtos", label: "Produtos", icon: "box", description: "Cadastre os produtos usados nas compras, no estoque e nas vendas." },
  { id: "estoque", label: "Estoque", icon: "box", description: "Consulte saldos, registre movimentações e transfira produtos entre unidades." },
  { id: "compras", label: "Compras", icon: "bag", description: "Registre compras, dê entrada na unidade correta e organize as notas de fornecedores." },
  { id: "vendas", label: "Vendas", icon: "bag", description: "Registre vendas por unidade e acompanhe o histórico de cada operação." },
  { id: "bens", label: "Bens", icon: "box", description: "Acompanhe os bens da empresa e os produtos recebidos em troca por unidade." },
  { id: "fornecedores", label: "Fornecedores", icon: "users", description: "Cadastre os fornecedores usados nas compras." },
  { id: "funcionarios", label: "Funcionários", icon: "users", description: "Acompanhe equipe, remuneração, vendas do mês e vales por unidade." },
  { id: "compromissos", label: "Compromissos", icon: "bag", description: "Cadastre contas a pagar e a receber e acompanhe os compromissos em aberto." },
  { id: "distribuicoes", label: "Distribuição de lucro", icon: "bag", description: "Registre o valor distribuído, o beneficiário e a unidade de origem." },
  { id: "financeiro", label: "Financeiro", icon: "grid", description: "Acompanhe DRE, caixa, contas a pagar e a receber por unidade.", admin: true },
  { id: "lojas", label: "Todas as lojas", icon: "pin", description: "Cadastre unidades e configure equipe, custos fixos e estrutura.", admin: true },
  { id: "crm", label: "Clientes / CRM", icon: "users", description: "Consulte fichas, histórico de compras e vendas, documentos e retornos por unidade." },
  { id: "simulador", label: "Simular venda", icon: "bolt", description: "Monte uma proposta de cartão durante o atendimento com produtos em estoque." },
  { id: "impostos", label: "Impostos", icon: "bag", description: "Configure alíquotas e o imposto padrão das novas vendas." },
  { id: "taxas", label: "Taxas e maquininhas", icon: "bag", description: "Cadastre e ajuste as condições de débito e crédito das maquininhas.", admin: true },
  { id: "usuarios", label: "Usuários", icon: "users", description: "Gerencie o acesso da equipe de atendimento.", admin: true },
  { id: "logs", label: "Log de ações", icon: "grid", description: "Confira as operações registradas e quem as realizou.", admin: true },
  { id: "consignados", label: "Consignados", icon: "box", description: "Acompanhe os lotes consignados disponíveis por unidade." },
  { id: "catalogo", label: "Catálogo do site", icon: "box", description: "Escolha quais modelos aparecem na landing page." },
  { id: "relatos", label: "Relatos da landing", icon: "users", description: "Organize os relatos autorizados exibidos no site.", admin: true },
] as const;
type Tab = typeof nav[number]["id"];
const navGroups: { title: string; tabs: Tab[] }[] = [
  { title: "Operação", tabs: ["visao", "vendas", "simulador", "crm", "produtos", "estoque", "consignados", "compras"] },
  { title: "Gestão", tabs: ["funcionarios", "fornecedores", "bens", "financeiro", "distribuicoes", "compromissos", "taxas", "impostos", "usuarios", "logs"] },
  { title: "Landing page", tabs: ["catalogo", "relatos"] },
];
const moduleActions: Partial<Record<Tab, { label: string; target: string }>> = {
  distribuicoes: { label: "Registrar distribuição", target: "nova-distribuicao" },
  taxas: { label: "Cadastrar maquininha", target: "nova-maquininha" },
  funcionarios: { label: "Cadastrar funcionário", target: "novo-funcionario" },
  fornecedores: { label: "Novo fornecedor", target: "novo-fornecedor" },
  estoque: { label: "Movimentar estoque", target: "movimentar-estoque" },
  produtos: { label: "Novo produto", target: "novo-produto" },
  compras: { label: "Registrar compra", target: "registrar-compra" },
  vendas: { label: "Nova venda", target: "nova-venda" },
  crm: { label: "Novo cliente", target: "novo-cliente" },
  compromissos: { label: "Novo compromisso", target: "novo-compromisso" },
};
type Filter = StoreId | "";

function adminUrl(tab: Tab, store: Filter = "") {
  return "/admin?" + new URLSearchParams(store ? { tab, loja: store } : { tab });
}
const dateLabel = (value: string) => new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
}).format(new Date(value));
const calendarLabel = (value: string) => value.split("-").reverse().join("/");

function FilterInput({ filter }: { filter: Filter }) {
  return <input type="hidden" name="filter" value={filter} />;
}

function StoreField({ filter, units, label = "Unidade" }: { filter: Filter; units: readonly Store[]; label?: string }) {
  return <label>{label}<select name="store" defaultValue={filter} required><option value="" disabled>Selecione a unidade</option>{units.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="admin-empty">{children}</p>;
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

function InvoiceLinks({ invoices }: { invoices: InvoiceMeta[] }) {
  return invoices.length > 0 && <ul className="invoice-links">{invoices.map((invoice) => (
    <li key={invoice._id}><a href={`/admin/notas/${invoice._id}`}>↓ {invoice.name}</a><span className="pill">{invoice.kind}</span></li>
  ))}</ul>;
}

function InvoiceBox({ owner, id, filter, invoices }: { owner: InvoiceOwner; id: string; filter: Filter; invoices: InvoiceMeta[] }) {
  return <section className="invoice-box" aria-label="Notas fiscais">
    <h3>{owner === "asset" ? "Comprovantes fiscais" : "Notas fiscais"}</h3>
    <InvoiceLinks invoices={invoices.filter((invoice) => invoice.owner === owner && invoice.ownerId === id)} />
    <form action={attachInvoice} className="invoice-form">
      <FilterInput filter={filter} />
      <input type="hidden" name="owner" value={owner} />
      <input type="hidden" name="ownerId" value={id} />
      <input type="hidden" name="focus" value={id} />
      {owner === "client" && <label>Tipo de nota<SearchSelect name="kind"><option>Venda</option><option>Compra</option></SearchSelect></label>}
      <AttachmentPicker name="invoice" label="Selecionar documento" accept=".pdf,.xml" hint="PDF ou XML · até 8 MB" required />
      <div><Submit>{owner === "asset" ? "Anexar comprovante" : "Anexar nota fiscal"}</Submit></div>
    </form>
  </section>;
}

function Overview({ state, filter, showSales }: { state: RetailState; filter: Filter; showSales: boolean }) {
  const sales = state.sales.filter((sale) => !sale.canceledAt && (!filter || sale.store === filter));
  const contacts = state.contacts.filter((contact) => !filter || contact.store === filter);
  const stock = (store: StoreId) => state.products.reduce((total, product) => total + (product.stock[store] ?? 0), 0);
  const metrics = [
    { label: "Vendas registradas", value: sales.length, detail: "Vendas ativas no histórico", icon: "bag" },
    { label: "Valor em vendas", value: money(sales.reduce((sum, sale) => sum + sale.total, 0)), detail: "Total líquido de descontos", icon: "bolt" },
    { label: "Unidades em estoque", value: filter ? stock(filter) : storeList(state).reduce((sum, unit) => sum + stock(unit.id), 0), detail: state.products.length + " produtos no catálogo interno", icon: "box" },
    { label: "Atendimentos abertos", value: contacts.length, detail: "Contatos em acompanhamento", icon: "users" },
  ] as const;
  return <>
    <div className="metrics-grid">{metrics.map((item) => <article key={item.label} className="metric panel"><span className="metric-icon"><Icon name={item.icon} size={19} /></span><p>{item.label}</p><strong>{item.value}</strong><small>{item.detail}</small></article>)}</div>
    <Charts state={state} filter={filter} />
    <div className="overview-grid">
      {showSales && <section className="panel"><div className="panel-title"><h2>Vendas recentes</h2><Link className="back-link" href={adminUrl("vendas", filter)}>Ver vendas →</Link></div>
        {sales.length ? <SalesTable state={state} sales={sales.slice(0, 5)} filter={filter} /> : <Empty>As vendas registradas nesta unidade aparecerão aqui.</Empty>}
      </section>}
      <section className="panel"><div className="panel-title"><h2>Suas unidades</h2><span className="pill">{storeList(state).length} LOJAS</span></div>
        <div className="branch-list">{storeList(state).map((store) => <Link href={adminUrl("visao", store.id)} key={store.id}><span className="metric-icon"><Icon name="pin" size={18} /></span><span><strong>{store.name}</strong><small>{stock(store.id)} unidades em estoque</small></span><Icon name="arrow" size={17} /></Link>)}</div>
      </section>
    </div>
  </>;
}

function Consignment({ state, filter, detailed = false, showPurchases = false }: {
  state: RetailState; filter: Filter; detailed?: boolean; showPurchases?: boolean;
}) {
  const { lots, cost } = stockComposition(state, filter);
  const scooters = stockComposition({ ...state, products: state.products.filter((item) => item.category === "Scooter elétrica") }, filter);
  const percent = (quantity: number) => scooters.total ? quantity / scooters.total * 100 : 0;
  const format = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
  return <section className="panel">
    <div className="panel-title"><h2>Consignação no estoque atual</h2>
      {detailed ? showPurchases && <Link className="back-link" href={adminUrl("compras", filter)}>Registrar entrada em Compras →</Link>
        : <Link className="back-link" href={adminUrl("consignados", filter)}>Ver lotes →</Link>}
    </div>
    <dl className="finance-rows">
      <div><dt>Valor total consignado a custo de repasse</dt><dd>{money(cost)}</dd></div>
      <div><dt>Scooters consignadas</dt><dd>{scooters.consigned} de {scooters.total}</dd></div>
    </dl>
    <div className="consignment-chart">
      {scooters.total > 0 && <div className="consignment-bar" aria-hidden="true"><span style={{ width: percent(scooters.consigned) + "%" }} /></div>}
      <p>Consignadas <strong>{format.format(percent(scooters.consigned))}%</strong> · Próprias ou sem lote <strong>{format.format(percent(scooters.owned))}%</strong></p>

    </div>
    {detailed && (lots.length ? <Table headers={["Produto", "Cor", "Unidade", "Fornecedor", "Entrada", "Saldo", "Valor de repasse", "Ação"]}>
      {lots.map((lot) => <tr key={lot.purchaseId + lot.store}>
        <td>{state.products.find((product) => product.id === lot.productId)?.name ?? lot.productId}</td>
        <td>{lot.color ?? "Sem cor definida"}</td><td>{storeName(lot.store, state)}</td><td>{lot.supplier}</td><td>{calendarLabel(lot.date)}</td>
        <td>{lot.quantity} un.</td><td>{money(lot.quantity * lot.unitCost)}</td>
        <td><DetailsDialog id={"devolucao-" + lot.purchaseId + "-" + lot.store} title="Estornar consignado" trigger="Estornar">
          <form className="admin-form" action={returnConsignment}>
            <FilterInput filter={filter} />
            <input type="hidden" name="movementId" value={randomUUID()} />
            <input type="hidden" name="purchaseId" value={lot.purchaseId} />
            <input type="hidden" name="productId" value={lot.productId} />
            <input type="hidden" name="store" value={lot.store} />
            <p className="span-two">{state.products.find((item) => item.id === lot.productId)?.name ?? lot.productId} · {lot.supplier} · {storeName(lot.store, state)}</p>
            <label>Quantidade devolvida<input name="quantity" type="number" min={1} max={lot.quantity} step={1} defaultValue={1} required /></label>
            <p className="form-note span-two">Saldo disponível neste lote: {lot.quantity} un. A devolução será registrada no histórico do estoque.</p>
            <div className="span-two"><Submit variant="danger">Confirmar devolução</Submit></div>
          </form>
        </DetailsDialog></td>
      </tr>)}
    </Table> : <Empty>Nenhum lote consignado com saldo nesta seleção.</Empty>)}
  </section>;
}

function CatalogSettings({ state, showProducts, requestedPage }: { state: RetailState; showProducts: boolean; requestedPage?: string }) {
  const vehicles = state.products.filter((product) => product.category === "Scooter elétrica" || product.category === "Bicicleta elétrica");
  const page = stockPage(vehicles.length, requestedPage);
  return <section className="panel">
    <div className="panel-title"><h2>Modelos no site</h2><Link className="back-link" href="/modelos">Ver catálogo público →</Link></div>
    {vehicles.length ? <Table headers={["Modelo", "Publicação", "Dados a completar", "Ações"]}>
      {vehicles.slice(page.start, page.start + stockPageSize).map((product) => {
        const missing = [
          ...(!productColorAvailability(product, state.stockLots).length ? ["Cores"] : []),
          ...(!product.imageUrl ? ["Foto"] : []), ...(!product.description?.trim() ? ["Descrição"] : []),
          ...(!product.price || product.sku.startsWith("DEMO-") ? ["Preço de venda"] : []),
          ...scooterFields.filter(({ key }) => key !== "colors" && !product.specs?.[key]?.trim()).map(({ label }) => label),
        ];
        return <tr key={product.id}>
          <td><strong>{product.name}</strong><small>{product.sku}</small>{product.colors?.length ? <small>{product.colors.join(" · ")}</small> : null}</td>
          <td><span className={"pill " + (product.published ? "green" : "")}>{product.published ? "Publicado" : "Oculto"}</span></td>
          <td><div className="inventory-tags">
            {missing.length ? missing.map((label) => <span className="pill" key={label}>{label}</span>) : <span className="pill green">Dados completos</span>}
          </div></td>
          <td><div className="catalog-admin-actions">
            <DetailsDialog id={"preview-" + product.id} title="Prévia no catálogo" trigger="Ver prévia">
              <div className="sale-detail-content">
                <div className="site" style={{ width: "100%", maxWidth: 430, marginInline: "auto" }}><ModelCard product={product} colors={productColorAvailability(product, state.stockLots)} /></div>
              </div>
            </DetailsDialog>
            <form action={savePublication}>
              <input type="hidden" name="id" value={product.id} />
              <input type="hidden" name="catalogoPagina" value={page.current} />
              {!product.published && <input type="hidden" name="published" value="on" />}
              {product.published ? <button type="submit" className="button">Despublicar</button> : <Submit>Publicar</Submit>}
            </form>
            {showProducts && <Link className="button" href={adminUrl("produtos") + "&ficha=" + encodeURIComponent(product.id)}>Editar produto</Link>}
          </div></td>
        </tr>;
      })}
    </Table> : <Empty>Cadastre um modelo em Produtos para publicar no site.</Empty>}
    <StockPagination name="modelos do catálogo" page={page} href={(number) => adminUrl("catalogo") + "&catalogoPagina=" + number} />
  </section>;
}

function ProductForm({ filter, product }: { filter: Filter; product?: Product }) {
  return <form className="admin-form" action={saveProduct}>
    <FilterInput filter={filter} />{product && <><input type="hidden" name="id" value={product.id} /><input type="hidden" name="focus" value={product.id} /></>}
    <ProductCategoryFields product={product && { category: product.category, specs: product.specs }}>
    <label>Nome<input name="name" required maxLength={100} defaultValue={product?.name} placeholder="Nome comercial" /></label>
    <label>SKU<input name="sku" required maxLength={40} defaultValue={product?.sku} placeholder="Código do produto" /></label>
    </ProductCategoryFields>
    <ProductColorsField initial={product?.colors} />
    <label>Preço de venda (R$)<input name="price" inputMode="decimal" maxLength={32} defaultValue={product ? (product.price / 100).toFixed(2).replace(".", ",") : ""} placeholder="0,00" /></label>
    {product?.imageUrl && <div className="product-photo-preview span-two">
      <Image src={product.imageUrl} alt={product.name} width={96} height={72} unoptimized />
      <label className="checkbox"><input name="removePhoto" type="checkbox" /> Retirar a foto atual</label>
    </div>}
    <div className="span-two"><AttachmentPicker name="photo" label={product?.imageUrl ? "Substituir foto" : "Selecionar foto"} accept="image/jpeg,image/png,image/webp" hint="JPG, PNG ou WebP · até 5 MB" /></div>
    <label className="span-two">Descrição<textarea name="description" rows={2} maxLength={350} defaultValue={product?.description} /></label>
    <div className="span-two"><Submit>{product ? "Salvar alterações" : "Cadastrar produto"}</Submit></div>
  </form>;
}

function searchText(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

function matchesSearch(query: string, ...fields: string[]) {
  return !query || searchText(fields.join(" ")).includes(searchText(query));
}

function CategoryFilters({ tab, filter, category, query, view }: { tab: "estoque" | "produtos" | "compras"; filter: Filter; category?: Product["category"]; query: string; view?: string }) {
  return <nav className="stock-category-filter" aria-label="Filtrar por categoria">
      {[undefined, ...productCategories].map((item) => <Link key={item ?? "all"} aria-current={item === category ? "true" : undefined}
        href={adminUrl(tab, filter) + "&" + new URLSearchParams({ ...(item ? { categoria: item } : {}), ...(query ? { busca: query } : {}), ...(view ? { estoqueVisao: view } : {}) })}>
        {item ?? "Todas as categorias"}
      </Link>)}
    </nav>;
}

function Products({ products, filter, query, focus, error, category }: { products: Product[]; filter: Filter; query: string; focus?: string; error?: string; category?: Product["category"] }) {
  return <>
    <CreateDialog id="novo-produto" title="Novo produto" reopen={Boolean(error && !focus)}>
      {error && !focus && <p className="feedback error" role="alert">{error}</p>}
      <ProductForm filter={filter} />
    </CreateDialog>
    <section className="panel">
      <div className="panel-title"><h2>Produtos cadastrados</h2><span className="pill">{products.length} produto(s)</span></div>
      <div className="panel-title">
        <CategoryFilters tab="produtos" filter={filter} category={category} query={query} />
        <RecordSearch key={filter + ":" + (category ?? "")} tab="produtos" store={filter} category={category} query={query} />
      </div>
      {products.length ? <Table headers={["Categoria", "Produto", "Preço de venda", "Status", "Ação"]}>
        {products.map((product) => <tr key={product.id}>
          <td>{product.category === "Bicicleta elétrica" ? "Reclassificar" : product.category}</td>
          <td><strong>{product.name}</strong><small>{product.sku}</small></td><td>{money(product.price)}</td>
          <td><span className="pill">{product.published ? "Na landing" : "Interno"}</span></td>
          <td><DetailsDialog id={"produto-" + product.id} title={product.name} trigger="Editar detalhes" reopen={focus === product.id}>
            <div className="sale-detail-content">
              {error && focus === product.id && <p className="feedback error" role="alert">{error}</p>}
              <ProductForm product={product} filter={filter} />
              <div className="record-actions"><Link className="back-link" href={adminUrl("compras", filter) + "&produto=" + encodeURIComponent(product.id) + "#registrar-compra"}>Registrar compra deste produto →</Link></div>
            </div>
          </DetailsDialog></td>
        </tr>)}
      </Table> : <Empty>{query || category ? "Nenhum produto encontrado." : "Cadastre seu primeiro produto para liberar movimentações e vendas."}</Empty>}
    </section>
  </>;
}

function Purchases({ state, filter, invoices, focus, productId, query, category, error, canCreateProduct, canCancel }: {
  state: RetailState; filter: Filter; invoices: InvoiceMeta[]; focus?: string; productId?: string; query: string; category?: Product["category"]; error?: string; canCreateProduct: boolean; canCancel: boolean;
}) {
  const productCategoriesById = new Map(state.products.map((item) => [item.id, item.category]));
  const purchases = state.purchases.filter((purchase) => (!filter || purchase.store === filter) && (!category || productCategoriesById.get(purchase.productId) === category) && matchesSearch(query, purchase.productName, purchase.sku, purchase.supplier));
  const product = state.products.find((item) => item.id === productId);
  const purchaseId = randomUUID();
  const focusedPurchase = purchases.some((item) => item.id === focus);
  return <>
    <section className="panel">
      <div className="panel-title"><h2>Histórico de compras</h2><span className="pill">{purchases.length} compras</span></div>
      <div className="panel-title">
        <CategoryFilters tab="compras" filter={filter} category={category} query={query} />
        <RecordSearch key={filter + ":" + (category ?? "")} tab="compras" store={filter} category={category} query={query} />
      </div>
      {purchases.length ? <Table headers={["Categoria", "Produto", "Cor", "Data", "Unidade", "Fornecedor", "Condição", "Total", "Ação"]}>{purchases.map((purchase) => (
        <tr key={purchase.id}>
          <td>{productCategories.find((item) => item === productCategoriesById.get(purchase.productId)) ?? "—"}</td>
          <td><strong>{purchase.productName}</strong><small>{purchase.sku}</small></td><td>{purchase.color ?? "Sem cor definida"}</td>
          <td>{calendarLabel(purchase.date)}</td><td>{storeName(purchase.store, state)}</td><td>{purchase.supplier}</td>
          <td><span className="pill">{purchaseStatus(state, purchase.id, purchase.acquisition)}</span></td>
          <td>{money(purchase.total)}</td>
          <td><DetailsDialog id={"compra-" + purchase.id} title="Detalhes da compra" reopen={focus === purchase.id}>
          <div className="sale-detail-content">
          {error && focus === purchase.id && <p className="feedback error" role="alert">{error}</p>}
          <div className="sale-detail-card"><h3>{purchase.productName}</h3>
            <p>{calendarLabel(purchase.date)} · {storeName(purchase.store, state)} · {purchase.supplier}</p>
            <p>{purchaseStatus(state, purchase.id, purchase.acquisition)} · {money(purchase.total)}</p>
          </div>
          <div className="record-actions">
            <p>{purchase.sku} · {purchase.quantity} un. × {money(purchase.unitCost)}</p>
            {purchase.openingBalance && <p>Regularização de saldo anterior</p>}
            {purchase.invoiceNumber && <p>Nota fiscal nº {purchase.invoiceNumber}</p>}
            {purchase.notes && <p>{purchase.notes}</p>}
            {purchase.specs && <dl className="purchase-specs">{scooterFields.filter(({ key }) => purchase.specs?.[key]).map(({ key, label }) => (
              <div key={key}><dt>{label}</dt><dd>{purchase.specs?.[key]}</dd></div>
            ))}</dl>}
          </div>
          {!purchase.canceledAt && <form className="admin-form" action={savePurchaseCost}>
            <FilterInput filter={filter} /><input type="hidden" name="focus" value={purchase.id} />
            <label>Custo unitário do lote (R$)<input name="unitCost" inputMode="decimal" required defaultValue={(purchase.unitCost / 100).toFixed(2).replace(".", ",")} /></label>
            <div><Submit>Atualizar custo do lote</Submit></div>
            <p className="form-note span-two">As vendas já registradas mantêm seus custos. Ajuste-as pelo histórico de vendas, se necessário.</p>
          </form>}
          {canCancel && !purchase.canceledAt && <details className="sale-detail-card cancel-sale">
            <summary>Cancelar compra</summary>
            <form action={reversePurchase}>
              <FilterInput filter={filter} /><input type="hidden" name="focus" value={purchase.id} />
              <p>{purchase.openingBalance ? "O vínculo com o lote será removido e o saldo das unidades será mantido." : "A entrada será revertida nas unidades onde o lote está disponível."}</p>
              {state.ledger.some((entry) => entry.id === purchase.id + "-payable" && entry.settlements.some((item) => !item.reversedOn)) &&
                <label className="checkbox"><input type="checkbox" name="paymentReversed" required /> O pagamento foi devolvido ou lançado por engano.</label>}
              <Submit variant="danger">Confirmar cancelamento</Submit>
            </form>
          </details>}
          {purchase.canceledAt && <p className="form-note">Cancelada em {dateLabel(purchase.canceledAt)}</p>}
          {!purchase.canceledAt && <form className="admin-form" action={savePurchaseColor}>
            <FilterInput filter={filter} /><input type="hidden" name="focus" value={purchase.id} />
            <LotColorField initial={purchase.color} /><div><Submit>Salvar cor do lote</Submit></div>
          </form>}
          <InvoiceBox owner="purchase" id={purchase.id} filter={filter} invoices={invoices} />
          </div></DetailsDialog></td>
        </tr>
      ))}</Table> : <Empty>{query || category ? "Nenhuma compra encontrada." : "As compras registradas nesta unidade aparecerão aqui."}</Empty>}
    </section>
    <CreateDialog id="registrar-compra" title="Registrar compra" reopen={Boolean(error && !focusedPurchase)}>
      {error && !focusedPurchase && <p className="feedback error" role="alert">{error}</p>}
      {(state.products.length > 0 || canCreateProduct) ? <form action={savePurchase} className="admin-form">
        <FilterInput filter={filter} />
        <input type="hidden" name="purchaseId" value={purchaseId} />
        <input type="hidden" name="focus" value={purchaseId} />
        <PurchaseProductFields canCreate={canCreateProduct} initialId={product?.id} products={state.products.map(({ id, name, sku, category, specs }) => ({ id, name, sku, category, specs }))} />
        <LotColorField />
        <StoreField units={storeList(state)} filter={filter} label="Unidade que recebe o estoque" />
        <SupplierField suppliers={state.suppliers.map(({ id, name }) => ({ id, name }))} />
        <label>Cliente vinculado (opcional)<SearchSelect name="contactId"><option value="">Sem vínculo</option>{state.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name} · {storeName(contact.store, state)}</option>)}</SearchSelect></label>
        <label>Quantidade<input name="quantity" type="number" min="1" max="999999" defaultValue="1" required /></label>

        <label>Data da compra<input name="date" type="date" defaultValue={new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date())} required /></label>
        <label>Número da nota (opcional)<input name="invoiceNumber" maxLength={44} /></label>
        <label>Condição da compra<SearchSelect name="acquisition" defaultValue="" required>
          <option value="" disabled>Selecione a condição</option><option value="quitada">Já quitada</option><option value="a-pagar">A pagar</option><option value="consignada">Consignada</option>
        </SearchSelect></label>
        <label>Vencimento (se a pagar)<input name="due" type="date" /></label>
        <label className="span-two">Observações<textarea name="notes" rows={2} maxLength={500} /></label>
        <label className="checkbox span-two"><input name="openingBalance" type="checkbox" /> Vincular esta compra a unidades antigas que já estão no estoque</label>
        <p className="form-note span-two">Uma compra nova cria um lote e dá entrada no estoque. Ao vincular saldo antigo, o lote recebe o custo sem duplicar unidades nem gerar cobrança.</p>
        <div className="span-two"><Submit>Registrar compra</Submit></div>
      </form> : <Empty><Link href={adminUrl("produtos", filter)}>Cadastre um produto para registrar compras →</Link></Empty>}
    </CreateDialog>
  </>;
}

function StructureAssetForm({ state, filter, asset }: { state: RetailState; filter: Filter; asset?: Asset }) {
  return <form className="admin-form" action={saveStoreItem}>
    <FilterInput filter={filter} />
    <input type="hidden" name="assetPage" value="1" /><input type="hidden" name="kind" value="asset" />
    {!asset && <input type="hidden" name="assetId" value={randomUUID()} />}
    {asset && <><input type="hidden" name="id" value={asset.id} /><input type="hidden" name="focus" value={asset.id} /></>}
    <label>Nome do bem<input name="name" required maxLength={100} defaultValue={asset?.name} /></label>
    <StoreField units={storeList(state)} filter={asset?.store ?? filter} />
    <label>Quantidade<input name="quantity" type="number" min={1} max={999999} defaultValue={asset?.quantity ?? 1} required /></label>
    <label>Valor total de aquisição (R$)<input name="amount" inputMode="decimal" maxLength={32} defaultValue={asset ? (asset.amount / 100).toFixed(2).replace(".", ",") : ""} /></label>
    <label>Data de aquisição<input name="acquiredOn" type="date" defaultValue={asset?.acquiredOn} required={!asset} /></label>
    <label className="span-two">Localização ou observações<textarea name="notes" maxLength={500} rows={3} defaultValue={asset?.notes} /></label>
    {!asset && <div className="span-two"><AttachmentPicker name="invoice" label="Selecionar comprovante fiscal (opcional)" accept=".pdf,.xml" hint="PDF ou XML · até 8 MB" /></div>}
    <div className="span-two"><Submit>Salvar bem</Submit></div>
  </form>;
}

function CompanyAssets({ state, filter, showSales, invoices, focus, error, success }: { state: RetailState; filter: Filter; showSales: boolean; invoices: InvoiceMeta[]; focus?: string; error?: string; success?: string }) {
  const assets = tradeInAssets(state, filter || undefined);
  const tradeIns = assets.filter((item) => !item.resale);
  const sold = assets.filter((item) => item.resale);
  const structure = state.assets.filter((item) => !filter || item.store === filter);
  const totalTradeIns = tradeIns.reduce((sum, item) => sum + (item.received ? item.amount : 0), 0);
  const focusedStructure = structure.some((item) => item.id === focus);
  const totalStructure = structure.reduce((sum, item) => sum + item.amount, 0);
  return <>
    <div className="dashboard-values">
      <div><p>Bens de troca disponíveis</p><strong>{money(totalTradeIns)}</strong></div>
      <div><p>Estrutura cadastrada nas lojas</p><strong>{money(totalStructure)}</strong></div>
    </div>
    <section className="panel">
      <div className="panel-title"><h2>Bens de troca</h2></div>
      {tradeIns.length ? <Table headers={["Bem", "Unidade", "Cliente", "Data da venda", "Valor acordado", "Status", "Ações"]}>
        {tradeIns.map((item) => <tr key={item.id}>
          <td><strong>{item.name}</strong></td><td>{storeName(item.store, state)}</td><td>{item.customer}</td>
          <td>{dateLabel(item.createdAt)}</td><td>{money(item.amount)}</td><td><span className={"pill " + (item.received ? "green" : "")}>{item.received ? "Recebido" : "A receber"}</span></td>
          <td><div className="workspace-section-links">
            {item.received && <DetailsDialog id={"vender-bem-" + item.id} title="Vender bem" trigger="Vender bem">
              <form action={saveTradeInSale} className="admin-form">
                <FilterInput filter={filter} /><input type="hidden" name="assetId" value={item.id} />
                <p className="span-two">{item.name} · {storeName(item.store, state)}</p>
                <label>Valor da venda recebido (R$)<input name="amount" inputMode="decimal" required maxLength={32} /></label>
                <label>Data do recebimento<input name="date" type="date" required defaultValue={new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date())} /></label>
                <div className="span-two"><Submit>Registrar venda do bem</Submit></div>
              </form>
            </DetailsDialog>}
            {showSales && <Link className="button" href={adminUrl("vendas", item.store) + "&ficha=" + encodeURIComponent(item.saleId)}>Ver venda original</Link>}
          </div></td>
        </tr>)}
      </Table> : <Empty>Nenhum bem de troca nesta seleção.</Empty>}
    </section>
    {sold.length > 0 && <section className="panel">
      <div className="panel-title"><h2>Histórico de bens vendidos</h2></div>
      <Table headers={["Bem", "Unidade", "Data do recebimento", "Valor da venda"]}>
        {sold.map((item) => item.resale && <tr key={item.id}>
          <td><strong>{item.name}</strong></td><td>{storeName(item.store, state)}</td>
          <td>{calendarLabel(item.resale.date)}</td><td>{money(item.resale.amount)}</td>
        </tr>)}
      </Table>
    </section>}
    <section className="panel">
      <div className="panel-title"><h2>Estrutura das lojas</h2><a className="button yellow" href="#novo-bem">＋ Adicionar novo bem</a></div>
      <CreateDialog id="novo-bem" title="Adicionar bem de estrutura" reopen={Boolean(error && !focusedStructure)}>
        {error && !focusedStructure && <p className="feedback error" role="alert">{error}</p>}
        <StructureAssetForm state={state} filter={filter} />
      </CreateDialog>
      {structure.length ? <Table headers={["Bem", "Unidade", "Quantidade", "Valor de aquisição", "Data de aquisição", "Ação"]}>
        {structure.map((item) => <tr key={item.id}>
          <td><strong>{item.name}</strong></td><td>{storeName(item.store, state)}</td><td>{item.quantity}</td><td>{money(item.amount)}</td>
          <td>{item.acquiredOn ? calendarLabel(item.acquiredOn) : "Não informada"}</td>
          <td><DetailsDialog id={"bem-" + item.id} title={item.name} trigger="Ver detalhes e editar" reopen={focus === item.id}>
            <div className="sale-detail-content">
              {focus === item.id && (error || success) && <p className={"feedback " + (error ? "error" : "success")} role={error ? "alert" : "status"}>{error || success}</p>}
              <section className="sale-detail-card"><h3>Dados do bem</h3><StructureAssetForm state={state} filter={filter} asset={item} /></section>
              <InvoiceBox owner="asset" id={item.id} filter={filter} invoices={invoices} />
            </div>
          </DetailsDialog></td>
        </tr>)}
      </Table> : <Empty>Nenhum bem de estrutura nesta seleção.</Empty>}
    </section>
  </>;
}

function ProfitDistributions({ state, filter, error }: { state: RetailState; filter: Filter; error?: string }) {
  const rows = state.ledger.filter((item) => item.kind === "distribuicao-lucro" && !item.canceled && (!filter || filter === item.store))
    .sort((a, b) => b.date.localeCompare(a.date));
  const entryId = randomUUID();
  return <>
    <CreateDialog id="nova-distribuicao" title="Registrar distribuição de lucro" reopen={Boolean(error)}>
      {error && <p className="feedback error" role="alert">{error}</p>}
      <form action={saveProfitDistribution} className="admin-form">
        <FilterInput filter={filter} /><input type="hidden" name="entryId" value={entryId} />
        <StoreField units={storeList(state)} filter={filter} label="Unidade de origem" />
        <label>Quem recebeu<input name="beneficiary" required maxLength={120} /></label>
        <label>Valor distribuído (R$)<input name="amount" required inputMode="decimal" maxLength={32} /></label>
        <label>Data da distribuição<input name="date" type="date" required /></label>
        <div className="span-two"><Submit>Registrar distribuição</Submit></div>
      </form>
    </CreateDialog>
    <section className="panel">
      <div className="panel-title"><h2>Distribuições registradas</h2></div>
      {rows.length ? <Table headers={["Data", "Unidade de origem", "Quem recebeu", "Valor"]}>
        {rows.map((item) => <tr key={item.id}><td>{calendarLabel(item.date)}</td><td>{storeName(item.store, state)}</td>
          <td>{item.beneficiary}</td><td><strong>{money(item.amount)}</strong></td></tr>)}
      </Table> : <Empty>Nenhuma distribuição registrada nesta seleção.</Empty>}
    </section>
  </>;
}

function SupplierForm({ supplier }: { supplier?: Supplier }) {
  return <form className="admin-form" action={saveSupplier}>
    {supplier && <><input type="hidden" name="id" value={supplier.id} /><input type="hidden" name="focus" value={supplier.id} /></>}
    <label className="span-two">Nome ou razão social<input name="name" defaultValue={supplier?.name} required maxLength={100} /></label>
    <label>CNPJ<input name="cnpj" defaultValue={supplier?.cnpj} maxLength={24} placeholder="00.000.000/0000-00" /></label>
    <label>Localização<input name="location" defaultValue={supplier?.location} maxLength={180} placeholder="Endereço, cidade e UF" /></label>
    <label>Telefone<input name="phone" type="tel" defaultValue={supplier?.phone} maxLength={32} /></label>
    <label>E-mail<input name="email" type="email" defaultValue={supplier?.email} maxLength={254} /></label>
    <label className="span-two">Observações<textarea name="notes" defaultValue={supplier?.notes} maxLength={500} rows={3} /></label>
    <div className="span-two"><Submit>Salvar fornecedor</Submit></div>
  </form>;
}

function Suppliers({ suppliers, focus, error, success }: { suppliers: Supplier[]; focus?: string; error?: string; success?: string }) {
  return <>
    <CreateDialog id="novo-fornecedor" title="Novo fornecedor" reopen={Boolean(error && !focus)}>
      {error && !focus && <p className="feedback error" role="alert">{error}</p>}
      <SupplierForm />
    </CreateDialog>
    <section className="panel">
      <div className="panel-title"><h2>Fornecedores cadastrados</h2><span className="pill">{suppliers.length}</span></div>
      {suppliers.length ? <Table headers={["Fornecedor", "CNPJ", "Localização", "Telefone", "E-mail", "Ação"]}>
        {suppliers.slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((supplier) => <tr key={supplier.id}>
          <td><strong>{supplier.name}</strong></td><td>{supplier.cnpj || "—"}</td><td>{supplier.location || "—"}</td><td>{supplier.phone || "—"}</td><td>{supplier.email || "—"}</td>
          <td><DetailsDialog id={"fornecedor-" + supplier.id} title={supplier.name} reopen={focus === supplier.id}>
            {focus === supplier.id && (error || success) && <p className={"feedback " + (error ? "error" : "success")} role={error ? "alert" : "status"}>{error || success}</p>}
            <SupplierForm supplier={supplier} />
          </DetailsDialog></td>
        </tr>)}
      </Table> : <Empty>Nenhum fornecedor cadastrado.</Empty>}
    </section>
  </>;
}

function purchaseStatus(state: RetailState, id: string, condition?: string) {
  if (state.purchases.some((purchase) => purchase.id === id && purchase.canceledAt)) return "Cancelada";
  if (condition === "consignada") return "Consignada";
  if (condition === "quitada") return "Quitada";
  if (condition === "a-pagar") {
    const entry = state.ledger.find((item) => item.id === id + "-payable");
    return entry && balanceDue(entry) === 0 ? "Quitada" : "A pagar";
  }
  return "Histórico sem classificação";
}

const stockPageSize = 10;
const stockViews = [
  { id: "produtos", label: "Produtos" },
  { id: "lotes", label: "Lotes" },
  { id: "movimentacoes", label: "Movimentações" },
] as const;

function stockPage(count: number, requested?: string) {
  const pages = Math.max(1, Math.ceil(count / stockPageSize));
  const number = Number(requested);
  const current = Number.isSafeInteger(number) ? Math.min(pages, Math.max(1, number)) : 1;
  return { count, pages, current, start: (current - 1) * stockPageSize };
}

function StockPagination({ name, page, href }: { name: string; page: ReturnType<typeof stockPage>; href: (number: number) => string }) {
  if (page.pages === 1) return null;
  return <nav className="panel-title" aria-label={"Páginas de " + name}>
    <span>Página {page.current} de {page.pages} · {page.start + 1}–{Math.min(page.start + stockPageSize, page.count)} de {page.count}</span>
    <div className="workspace-section-links">
      {page.current > 1 && <Link href={href(page.current - 1)}>Anterior</Link>}
      {page.current < page.pages && <Link href={href(page.current + 1)}>Próxima</Link>}
    </div>
  </nav>;
}

function Stock({ state, filter, category, showPurchases, movementPage, balancePage, lotPage, query, view, error }: { state: RetailState; filter: Filter; category?: Product["category"]; showPurchases: boolean; movementPage?: string; balancePage?: string; lotPage?: string; query: string; view: string; error?: string }) {
  const products = state.products.filter((product) => (!category || product.category === category) && matchesSearch(query, product.name, product.sku, product.category));
  const ids = new Set(products.map((product) => product.id));
  const columns = storeList(state).filter((store) => !filter || filter === store.id);
  const movements = state.movements.filter((movement) => (!(category || query) || ids.has(movement.productId)) && (!filter || movement.store === filter));
  const lots = state.stockLots.filter((item) => item.quantity > 0 && (!(category || query) || ids.has(item.productId)) && (!filter || item.store === filter));
  const colorsByStore = productColorStock(lots);
  const balances = stockPage(products.length, balancePage);
  const stockLots = stockPage(lots.length, lotPage);
  const history = stockPage(movements.length, movementPage);
  const pageUrl = (key: string, number: number, section: string) => {
    const params = new URLSearchParams({ estoqueVisao: view });
    if (category) params.set("categoria", category);
    if (query) params.set("busca", query);
    for (const [name, current] of [["saldosPagina", balances.current], ["lotesPagina", stockLots.current], ["movimentosPagina", history.current]] as const) {
      const selected = name === key ? number : current;
      if (selected > 1) params.set(name, String(selected));
    }
    return adminUrl("estoque", filter) + (params.size ? "&" + params : "") + "#" + section;
  };
  const tableFilters = <div className="panel-title">
    <CategoryFilters tab="estoque" filter={filter} category={category} query={query} view={view} />
    <RecordSearch key={view + ":" + filter + ":" + (category ?? "")} tab="estoque" store={filter} category={category} query={query} view={view} />
  </div>;
  return <>
    <nav className="branch-filter" aria-label="Seções do estoque">
      {stockViews.map(({ id, label }) => <Link key={id} aria-current={view === id ? "page" : undefined}
        href={adminUrl("estoque", filter) + "&" + new URLSearchParams({ estoqueVisao: id, ...(category ? { categoria: category } : {}), ...(query ? { busca: query } : {}) })}>{label}</Link>)}
    </nav>
    <CreateDialog id="movimentar-estoque" title="Movimentar estoque" reopen={Boolean(error)}>
      {error && <p className="feedback error" role="alert">{error}</p>}
      {state.products.length ? <form action={updateStock} className="admin-form">
        <FilterInput filter={filter} /><input type="hidden" name="stockCategory" value={category ?? ""} /><input type="hidden" name="stockView" value={view} /><input type="hidden" name="stockSearch" value={query} />
        <StockFields units={storeList(state)} initialStore={filter}
          products={state.products.map(({ id, name, sku }) => ({ id, name, sku }))}
          lots={state.stockLots.map(({ purchaseId, productId, store, color, quantity, supplier }) => ({ purchaseId, productId, store, color, quantity, supplier }))} />
        <div className="span-two"><Submit>Salvar operação</Submit></div>
      </form> : <Empty><Link href={adminUrl("produtos", filter)}>Ir para Produtos →</Link></Empty>}
    </CreateDialog>
    {view === "produtos" && <section id="saldos-estoque" className="panel"><div className="panel-title"><h2>Saldos por unidade</h2></div>
      {tableFilters}
      {products.length ? <Table headers={["Produto", ...columns.map((store) => store.name)]}>{products.slice(balances.start, balances.start + stockPageSize).map((product) => <tr key={product.id}><td><strong>{product.name}</strong><small>{product.sku} · {product.category}</small></td>{columns.map((store) => <td key={store.id}>
        <strong>{product.stock[store.id] ?? 0} un.</strong>
        {Object.entries(colorsByStore[product.id]?.[store.id] ?? {}).map(([color, quantity]) =>
          <small key={color}>{color} · {quantity} un.</small>)}
        {(product.stock[store.id] ?? 0) > 0 && <div className="inventory-tags">
          {(() => {
            const consigned = lots.filter((lot) => lot.store === store.id && lot.productId === product.id && lot.consigned)
              .reduce((sum, lot) => sum + lot.quantity, 0);
            const owned = (product.stock[store.id] ?? 0) - consigned;
            return <>{consigned > 0 && <span className="pill consigned">{consigned} consignado</span>}
              {owned > 0 && <span className="pill">{owned} próprio / avulso</span>}</>;
          })()}
        </div>}
      </td>)}</tr>)}</Table> : <Empty>Nenhum produto nesta seleção.</Empty>}
      <StockPagination name="saldos por unidade" page={balances} href={(number) => pageUrl("saldosPagina", number, "saldos-estoque")} />
    </section>}
    {view === "lotes" && <section id="lotes-estoque" className="panel"><div className="panel-title"><h2>Lotes em estoque · origem e condição</h2></div>
      {tableFilters}
      {lots.length ? <Table headers={["Produto", "Cor", "Unidade", "Fornecedor", "Condição", "Saldo", ...(showPurchases ? ["Custo unitário"] : [])]}>{lots.slice(stockLots.start, stockLots.start + stockPageSize).map((lot) => {
        const purchase = state.purchases.find((item) => item.id === lot.purchaseId);
        return <tr key={lot.purchaseId + lot.store}><td>{state.products.find((item) => item.id === lot.productId)?.name ?? lot.productId}</td><td>{lot.color ?? "Sem cor definida"}</td><td>{storeName(lot.store, state)}</td>
          <td>{lot.supplier}</td><td>{lot.consigned ? "Consignado" : "Próprio"}{purchase && " · " + purchaseStatus(state, lot.purchaseId, purchase.acquisition)}</td><td>{lot.quantity} un.</td>{showPurchases && <td>{money(lot.unitCost)}{purchase && <small><Link className="back-link" href={adminUrl("compras", purchase.store) + "&ficha=" + purchase.id}>Abrir compra</Link></small>}</td>}</tr>;
      })}</Table> : <Empty>Os lotes aparecem conforme você registra as compras.</Empty>}
      <StockPagination name="lotes em estoque" page={stockLots} href={(number) => pageUrl("lotesPagina", number, "lotes-estoque")} />
      <p className="admin-empty">Para vender unidades antigas sem lote, registre a compra em Compras e marque a opção de vincular ao saldo já existente.</p>
    </section>}
    {view === "movimentacoes" && <section id="movimentacoes-estoque" className="panel"><div className="panel-title"><h2>Histórico de movimentações</h2></div>
      {tableFilters}
      {movements.length ? <Table headers={["Data", "Produto", "Unidade", "Movimento", "Quantidade"]}>{movements.slice(history.start, history.start + stockPageSize).map((movement) => <tr key={movement.id}><td>{dateLabel(movement.createdAt)}</td><td>{movement.productName}</td><td>{storeName(movement.store, state)}</td><td>{movement.reason}</td><td>{movement.quantity > 0 ? "+" : ""}{movement.quantity}</td></tr>)}</Table> : <Empty>O histórico desta unidade está vazio.</Empty>}
      <StockPagination name="histórico de movimentações" page={history} href={(number) => pageUrl("movimentosPagina", number, "movimentacoes-estoque")} />
    </section>}
  </>;
}

function SaleDocuments({ sale, filter, invoices }: { sale: Sale; filter: Filter; invoices: InvoiceMeta[] }) {
  return <section className="sale-detail-card"><h3>Documentos</h3><div className="sale-document-grid">
    <div><h4>Contrato</h4><p>Minuta preenchida com os dados da venda, para revisão antes da assinatura.</p>
      {!sale.canceledAt && <a className="button sale-download" href={`/admin/vendas/${encodeURIComponent(sale.id)}/contrato`} download><span>Baixar contrato</span><span className="pill">PDF</span></a>}
    </div>
    {!sale.canceledAt && <div><h4>Ficha fiscal para o contador</h4>
      <p>Exporte os dados da venda e do produto para preparar a emissão. Após a autorização, anexe a nota abaixo.</p>
      <form action={saveSaleFiscalNotes} className="invoice-form">
        <FilterInput filter={filter} /><input type="hidden" name="focus" value={sale.id} />
        <label>Informações complementares<textarea name="fiscalNotes" rows={3} maxLength={1500}
          defaultValue={sale.fiscalNotes} placeholder="Ex.: número de série, chassi ou observações da operação" /></label>
        <Submit>Salvar informações</Submit>
      </form>
      <a className="button sale-download" href={`/admin/vendas/${encodeURIComponent(sale.id)}/fiscal`} download><span>Baixar ficha fiscal</span><span className="pill">PDF</span></a>
      <a className="button sale-download" href={`/admin/vendas/${encodeURIComponent(sale.id)}/fiscal?formato=xml`} download><span>Baixar prévia da NF-e</span><span className="pill">XML</span></a>
    </div>}
    <InvoiceBox owner="sale" id={sale.id} filter={filter} invoices={invoices} />
  </div></section>;
}

function saleStatus(sale: Sale, state: RetailState) {
  if (sale.canceledAt) return "Cancelada";
  const entries = state.ledger.filter((entry) => entry.saleId === sale.id && entry.kind === "venda" && !entry.canceled);
  if (!entries.length) return "Registrada";
  return entries.some((entry) => balanceDue(entry) > 0) ? "A receber" : "Recebida";
}

function SalesTable({ state, sales, filter, canCancel = false, invoices, focus, detailFeedback, canEditCosts = false, showCost = false }: { state: RetailState; sales: Sale[]; filter: Filter; canCancel?: boolean; invoices?: InvoiceMeta[] | null; focus?: string; detailFeedback?: { message: string; error: boolean }; canEditCosts?: boolean; showCost?: boolean }) {
  return <Table headers={["Venda", "Unidade", "Total", "Recebimento", ...(canCancel ? ["Nota fiscal", "Ação"] : [])]}>{sales.map((sale) => {
    const status = saleStatus(sale, state);
    const netProfit = saleNetProfit(sale);
    const receivables = state.ledger.filter((entry) => entry.saleId === sale.id && entry.kind === "venda" && !entry.canceled);
    const outstanding = receivables.reduce((total, entry) => total + balanceDue(entry), 0);
    const received = receivables.reduce((total, entry) => total + entry.amount - balanceDue(entry), 0);
    const hasInvoice = invoices?.some((invoice) => invoice.owner === "sale" && invoice.ownerId === sale.id);
    const invoiceStatus = invoices == null ? "Indisponível" : hasInvoice ? "Anexada" : "Não anexada";
    return <tr key={sale.id} id={"venda-" + sale.id}>
      <td><strong>{sale.customer}</strong><small>{(sale.lines ?? [sale]).map((line) => line.quantity + " × " + line.productName + ("gift" in line && line.gift ? " (brinde)" : "")).join(" · ")} · {dateLabel(sale.createdAt)}</small>{sale.sellerName && <small>Vendedor: {sale.sellerName}</small>}</td>
      <td>{storeName(sale.store, state)}</td><td><strong>{money(sale.total)}</strong><small>{sale.payments?.length ? sale.payments.map((payment) => payment.method + " " + money(payment.amount)).join(" · ") : sale.method}</small></td>
      <td><span className={"pill " + (status === "Recebida" ? "green" : "")}>{status}</span></td>
      {canCancel && <><td><span className={"pill " + (hasInvoice ? "green" : "")}>{invoiceStatus}</span></td><td>
        <DetailsDialog title="Detalhes da venda" id={"detalhes-" + sale.id} reopen={focus === sale.id}>
          <div className="sale-detail-content">
          {focus === sale.id && detailFeedback && <p className={"feedback " + (detailFeedback.error ? "error" : "success")} role={detailFeedback.error ? "alert" : "status"}>{detailFeedback.message}</p>}
          <div className="sale-detail-card sale-summary"><h3>{sale.customer}</h3><p>{storeName(sale.store, state)} · {dateLabel(sale.createdAt)}{sale.sellerName && " · " + sale.sellerName}</p>
            <div className="sale-statuses"><span className={"pill " + (status === "Recebida" ? "green" : "")}>{status}</span><span className={"pill " + (hasInvoice ? "green" : "")}>Nota fiscal {invoiceStatus.toLowerCase()}</span></div></div>
          <section className="sale-detail-card"><h3>Itens da venda</h3>
          <Table headers={["Item", "Qtd.", "Unitário", "Total", ...(showCost ? ["Custo"] : [])]}>
            {(sale.lines ?? [sale]).map((line, index) => <tr key={index}>
              <td>{line.productName}{"color" in line && line.color && " · " + line.color}{"gift" in line && line.gift && " (brinde)"}</td><td>{line.quantity}</td>
              <td>{money(line.unitPrice)}</td><td>{money(line.total)}</td>
              {showCost && <td>{line.cost == null || line.missingCostUnits ? "Pendente" : money(line.cost)}</td>}
            </tr>)}
          </Table></section>
          <section className="sale-detail-card"><h3>Pagamento</h3>
            <dl className="sale-payment-totals">
              <div><dt>Total da venda</dt><dd>{money(sale.total)}</dd></div>
              {receivables.length > 0 && <>
                <div><dt>Recebido</dt><dd>{money(received)}</dd></div>
                <div><dt>A receber</dt><dd>{money(outstanding)}</dd></div>
              </>}
            </dl>
            <dl className="sale-payment-lines">
              {(sale.payments?.length ? sale.payments : [{ method: sale.method, amount: sale.total }]).map((payment, index) =>
                <div key={index}><dt>{payment.method}</dt><dd>{money(payment.amount)}</dd></div>
              )}
              {sale.discount > 0 && <div><dt>Desconto aplicado</dt><dd>{money(sale.discount)}</dd></div>}
              {showCost && <>
                <div><dt>Taxas de cartão</dt><dd>{money(sale.cardFees ?? 0)}</dd></div>
                <div><dt>Imposto</dt><dd>{money(sale.tax?.amount ?? 0)}</dd></div>
                <div><dt>Comissão</dt><dd>{money(sale.commission ?? 0)}</dd></div>
              </>}
            </dl>
            {showCost && !sale.canceledAt && <div className="sale-payment-totals"><div>
              <dl><dt>Lucro líquido da venda</dt><dd>{netProfit == null ? "Custo pendente" : money(netProfit)}</dd></dl>
              <p>Desconta custos dos itens e brindes, taxas, impostos e comissão.</p>
            </div></div>}
          </section>
          <SaleDocuments sale={sale} filter={filter} invoices={invoices ?? []} />
          {canEditCosts && !sale.canceledAt && <details className="sale-detail-card sale-documents"><summary>Editar custos</summary>
        <form action={saveSaleCosts} className="invoice-form">
          <FilterInput filter={filter} /><input type="hidden" name="focus" value={sale.id} />
          {(sale.lines ?? [sale]).map((line, index) => <label key={index}>{line.productName} · custo total de {line.quantity} un.
            <input name="lineCost" inputMode="decimal" maxLength={32}
              defaultValue={line.cost == null || line.missingCostUnits ? "" : (line.cost / 100).toFixed(2).replace(".", ",")} />
          </label>)}
          <label>Comissão (R$)<input name="commission" inputMode="decimal" required maxLength={32}
            defaultValue={((sale.commission ?? 0) / 100).toFixed(2).replace(".", ",")} /></label>
          <label>Imposto (R$)<input name="tax" inputMode="decimal" required maxLength={32}
            defaultValue={((sale.tax?.amount ?? 0) / 100).toFixed(2).replace(".", ",")} /></label>
          {(sale.payments ?? [{ method: sale.method, amount: sale.total, fee: sale.cardFees ?? 0 }])
            .filter((payment) => payment.method === "Cartão").map((payment, index) =>
              <label key={index}>Taxa do cartão {index + 1} · pagamento de {money(payment.amount)} (R$)
                <input name="cardFee" inputMode="decimal" required maxLength={32}
                  defaultValue={(payment.fee / 100).toFixed(2).replace(".", ",")} />
              </label>)}
          <Submit>Salvar custos</Submit>
        </form>
      </details>}{!sale.canceledAt && <details className="sale-detail-card cancel-sale"><summary>Cancelar venda</summary>
        <form action={reverseSale}><FilterInput filter={filter} /><input type="hidden" name="saleId" value={sale.id} /><input type="hidden" name="focus" value={sale.id} />
          <p>As unidades voltam ao estoque de {storeName(sale.store, state)}.</p>
          <label className="checkbox"><input type="checkbox" name="refund" /> Já devolvi o valor recebido, se houver</label>
          <Submit variant="danger">Confirmar</Submit>
        </form></details>}
          </div>
        </DetailsDialog>
      </td></>}
    </tr>;
  })}</Table>;
}

function Sales({ state, filter, invoices, focus, error, showCost, canEditCosts, saleFilter, detailFeedback }: { state: RetailState; filter: Filter; invoices: InvoiceMeta[] | null; focus?: string; error?: string; showCost: boolean; canEditCosts: boolean; saleFilter?: string; detailFeedback?: { message: string; error: boolean } }) {
  const sales = state.sales.filter((sale) => !filter || sale.store === filter);
  const active = sales.filter((sale) => !sale.canceledAt);
  const attached = new Set(invoices?.filter((invoice) => invoice.owner === "sale").map((invoice) => invoice.ownerId));
  const filters = [
    { id: "", label: "Todas", rows: sales },
    { id: "a-receber", label: "A receber", rows: active.filter((sale) => saleStatus(sale, state) === "A receber") },
    ...(invoices === null ? [] : [
      { id: "sem-nota", label: "Sem nota anexada", rows: active.filter((sale) => !attached.has(sale.id)) },
      { id: "com-nota", label: "Com nota anexada", rows: active.filter((sale) => attached.has(sale.id)) },
    ]),
  ];
  const selected = filters.find((item) => item.id === saleFilter) ?? filters[0];
  const contacts = state.contacts.filter((contact) => !filter || contact.store === filter);
  const products = state.products.filter((product) => product.price > 0 && (filter ? product.stock[filter] > 0 : storeList(state).some((store) => product.stock[store.id] > 0)));
  const saleId = randomUUID();
  return <div className="sales-workspace">
    <CreateDialog id="nova-venda" title="Nova venda" key={saleId} reopen={Boolean(error)}>
      {error && <p className="feedback error" role="alert">{error}</p>}
      {products.length ? <form className="admin-form" action={saveSale}>
        <FilterInput filter={filter} /><input type="hidden" name="saleId" value={saleId} /><input type="hidden" name="focus" value={saleId} />
        <SaleCustomer contacts={contacts.map((contact) => ({ id: contact.id, label: contact.name + " · " + storeName(contact.store, state) }))} />
        <CheckoutFields units={storeList(state)} initialStore={filter} rates={state.cardRates} machines={state.cardMachines} taxRates={state.taxRates ?? []}
          products={state.products.map(({ id, name, sku, price, stock }) => ({ id, name, sku, price, stock }))}
          showCost={showCost}
          sellers={state.staff.filter((item) => item.active && (!filter || item.store === filter)).map(({ id, name, store, commissionBps }) => ({ id, name, store, commissionBps: showCost ? commissionBps : 0 }))}
          lots={state.stockLots.map((lot) => ({ ...lot, unitCost: showCost ? lot.unitCost : 0 }))} />
        <div className="span-two"><Submit>Registrar venda</Submit></div>
      </form> : <Empty>Para registrar uma venda, cadastre um produto com preço e adicione saldo à unidade em <Link href={adminUrl("estoque", filter)}>Estoque</Link>.</Empty>}
    </CreateDialog>
    <section className="panel sale-follow-up">
      <div className="panel-title"><h2>Acompanhamento de vendas</h2></div>
      <nav className="dashboard-values sale-filters" aria-label="Filtros de vendas">
        {filters.map(({ id, label, rows }) => <Link key={id}
          href={adminUrl("vendas", filter) + (id ? "&statusVenda=" + id : "")}
          aria-current={selected.id === id ? "true" : undefined}>
          <span>{label}</span><strong>{rows.length}</strong>
        </Link>)}
      </nav>
    </section>
    <section id="historico-vendas" className="panel">
      <div className="panel-title"><h2>Histórico de vendas</h2><span>{selected.label}</span></div>
      {selected.rows.length ? <SalesTable state={state} sales={selected.rows} filter={filter} canCancel canEditCosts={canEditCosts} showCost={showCost} invoices={invoices} focus={focus} detailFeedback={detailFeedback} /> : <Empty>Nenhuma venda registrada para este filtro.</Empty>}
    </section>
  </div>;
}

function ContactForm({ filter, contact, state }: { filter: Filter; contact?: Contact; state: RetailState }) {
  return <form className="admin-form" action={saveContact}>
    <FilterInput filter={filter} />{contact && <><input type="hidden" name="id" value={contact.id} /><input type="hidden" name="focus" value={contact.id} /></>}
    <label>Nome<input name="name" maxLength={100} defaultValue={contact?.name} required /></label>
    <label>Telefone<input name="phone" type="tel" maxLength={32} defaultValue={contact?.phone} /></label>
    <label>E-mail<input name="email" type="email" maxLength={254} defaultValue={contact?.email} /></label>
    <label>CPF<input name="cpf" inputMode="numeric" maxLength={20} defaultValue={contact?.cpf} placeholder="000.000.000-00" /></label>
    <label>Data de nascimento<input name="birthDate" type="date" min="1900-01-01" defaultValue={contact?.birthDate} /></label>
    <StoreField units={storeList(state)} filter={contact?.store ?? filter} />
    <fieldset className="address-fields span-two">
      <legend>Endereço</legend>
      <label>CEP<input name="postalCode" inputMode="numeric" maxLength={9} defaultValue={contact?.address?.postalCode} /></label>
      <label>Rua ou avenida<input name="street" maxLength={120} defaultValue={contact?.address?.street} /></label>
      <label>Número<input name="number" maxLength={16} defaultValue={contact?.address?.number} /></label>
      <label>Complemento<input name="complement" maxLength={100} defaultValue={contact?.address?.complement} /></label>
      <label>Bairro<input name="neighborhood" maxLength={80} defaultValue={contact?.address?.neighborhood} /></label>
      <label>Cidade<input name="city" maxLength={80} defaultValue={contact?.address?.city} /></label>
      <label>UF<input name="uf" maxLength={2} defaultValue={contact?.address?.state} placeholder="SC" /></label>
    </fieldset>
    <label>Etapa<SearchSelect name="stage" defaultValue={contact?.stage ?? stages[0]}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</SearchSelect></label>
    <label>Interesse<input name="interest" maxLength={100} defaultValue={contact?.interest} placeholder="Modelo ou necessidade" /></label>
    <label>Próximo retorno<input name="nextContact" type="date" defaultValue={contact?.nextContact} /></label>
    <label className="span-two">Observações<textarea name="notes" rows={2} maxLength={500} defaultValue={contact?.notes} /></label>
    <div className="span-two"><Submit>{contact ? "Salvar ficha" : "Cadastrar cliente"}</Submit></div>
  </form>;
}

function CRM({ state, filter, invoices, focus, showSales, showPurchases, stage, error, success, query }: {
  state: RetailState; filter: Filter; invoices: InvoiceMeta[]; focus?: string; showSales: boolean; showPurchases: boolean; stage?: string; error?: string; success?: string; query: string;
}) {
  const list = state.contacts.filter((contact) => (!filter || contact.store === filter) && matchesSearch(query, contact.name, contact.cpf ?? "", contact.phone ?? "", contact.email ?? ""));
  const selected = stages.find((item) => item === stage);
  const visible = selected ? list.filter((item) => item.stage === selected) : list;
  return <>
    <CreateDialog id="novo-cliente" title="Novo cliente" reopen={Boolean(error && !focus)}>
      {error && !focus && <p className="feedback error" role="alert">{error}</p>}
      <ContactForm state={state} filter={filter} />
    </CreateDialog>
    <nav className="dashboard-values sale-filters" aria-label="Filtrar clientes por etapa">
      {[{ label: "Todos", value: "" }, ...stages.map((item) => ({ label: item, value: item }))].map(({ label, value }) =>
        <Link key={label} href={adminUrl("crm", filter) + (value ? "&etapa=" + encodeURIComponent(value) : "") + (query ? "&" + new URLSearchParams({ busca: query }) : "")}
          aria-current={(selected ?? "") === value ? "true" : undefined}>
          <span>{label}</span><strong>{value ? list.filter((item) => item.stage === value).length : list.length}</strong>
        </Link>)}
    </nav>
    <section className="panel"><div className="panel-title"><h2>Clientes e oportunidades</h2></div>
      <div className="panel-title"><RecordSearch key={filter + ":" + (selected ?? "")} tab="crm" store={filter} stage={selected} query={query} /></div>
      {visible.length ? <Table headers={["Cliente", "Unidade", "Interesse", "Próximo retorno", "Status", "Ação"]}>
        {visible.map((contact) => <tr key={contact.id}>
          <td><strong>{contact.name}</strong></td>
          <td>{storeName(contact.store, state)}</td>
          <td>{contact.interest || "—"}</td>
          <td>{contact.nextContact ? calendarLabel(contact.nextContact) : "—"}</td>
          <td><span className="pill">{contact.stage}</span></td>
          <td><DetailsDialog id={"cliente-" + contact.id} title={contact.name} reopen={focus === contact.id}>
            <div className="sale-detail-content">
              {focus === contact.id && (error || success) && <p className={"feedback " + (error ? "error" : "success")} role={error ? "alert" : "status"}>{error || success}</p>}
              <section className="sale-detail-card"><h3>Dados do cliente</h3>
                <ContactForm state={state} filter={filter} contact={contact} />
              </section>
              <InvoiceBox owner="client" id={contact.id} filter={filter} invoices={invoices} />
              {(showSales || showPurchases) && <section className="sale-detail-card"><h3>Histórico vinculado</h3>
                <ClientHistory state={state} contact={contact} invoices={invoices} showSales={showSales} showPurchases={showPurchases} />
              </section>}
            </div>
          </DetailsDialog></td>
        </tr>)}
      </Table> : <Empty>{query ? "Nenhum cliente encontrado." : selected ? "Nenhum cliente nesta etapa." : "Adicione um contato para acompanhar a próxima conversa ou proposta."}</Empty>}
    </section>
  </>;
}

function ClientHistory({ state, contact, invoices, showSales, showPurchases }: {
  state: RetailState; contact: Contact; invoices: InvoiceMeta[]; showSales: boolean; showPurchases: boolean;
}) {
  const records = [
    ...state.sales.filter((sale) => showSales && sale.contactId === contact.id).map((sale) => ({
      ...sale, date: dateLabel(sale.createdAt), kind: "Venda", tab: "vendas" as const, owner: "sale", canceled: !!sale.canceledAt,
    })),
    ...state.purchases.filter((purchase) => showPurchases && purchase.contactId === contact.id).map((purchase) => ({
      ...purchase, date: calendarLabel(purchase.date), kind: "Compra", tab: "compras" as const, owner: "purchase", canceled: !!purchase.canceledAt,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!records.length) return <p className="form-note">Compras e vendas vinculadas a este cliente aparecem aqui.</p>;
  return <ul className="client-history">{records.map((record) => <li key={record.id}>
    <Link className="back-link" href={adminUrl(record.tab, record.store) + "&ficha=" + record.id}>{record.kind} · {record.productName}</Link>
    <p>{record.date} · {storeName(record.store, state)} · {money(record.total)}{record.canceled && " · Cancelada"}</p>
    <InvoiceLinks invoices={invoices.filter((invoice) => invoice.owner === record.owner && invoice.ownerId === record.id)} />
  </li>)}</ul>;
}

export const metadata = { title: "Painel de operação" };

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string; loja?: string; ok?: string; erro?: string; ficha?: string; produto?: string; categoria?: string; statusVenda?: string; tipoCompromisso?: string; prazoCompromisso?: string; compromissosVisao?: string; compromissosPagina?: string; baixaInicio?: string; baixaFim?: string; maquininha?: string; catalogoPagina?: string; estoqueVisao?: string; movimentosPagina?: string; saldosPagina?: string; lotesPagina?: string; busca?: string; etapa?: string; inicio?: string; fim?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const visibleNav = nav.filter((item) => canAccess(user, item.id));
  const requested = nav.find((item) => item.id === params.tab);
  const denied = !!requested && !canAccess(user, requested.id);
  const active = (denied ? undefined : requested) ?? visibleNav[0];
  if (!active) return <main className="admin-content"><h1>Acesso ao painel</h1><p>Nenhum módulo está liberado para esta conta.</p><SignOutDialog /></main>;
  const showSales = canAccess(user, "vendas");
  const showPurchases = canAccess(user, "compras");
  const period = reportPeriod(params.inicio, params.fim);
  const commitmentKind = ["fixos", "mensais", "avulsos"].find((item) => item === params.tipoCompromisso);
  const commitmentDeadline = ["mes", "atrasados", "a-vencer"].find((item) => item === params.prazoCompromisso);
  const commitmentView = params.compromissosVisao === "pagos" ? "pagos" : undefined;
  const paidFrom = params.baixaInicio && isCalendarDate(params.baixaInicio) ? params.baixaInicio : undefined;
  const paidTo = params.baixaFim && isCalendarDate(params.baixaFim) ? params.baixaFim : undefined;
  const commitmentQuery = active.id === "compromissos" ? "&" + new URLSearchParams({
    ...(commitmentKind ? { tipoCompromisso: commitmentKind } : {}),
    ...(commitmentDeadline ? { prazoCompromisso: commitmentDeadline } : {}),
    ...(commitmentView ? { compromissosVisao: commitmentView } : {}),
    ...(paidFrom ? { baixaInicio: paidFrom } : {}),
    ...(paidTo ? { baixaFim: paidTo } : {}),
  }) : "";
  const periodQuery = active.id === "financeiro" || active.id === "visao" ? "&" + new URLSearchParams({ inicio: period.from, fim: period.to }) : "";
  const showInvoices = ["compras", "vendas", "crm", "bens"].includes(active.id) || (active.id === "visao" && (showSales || showPurchases));
  const [state, invoices, users] = await Promise.all([
    denied ? null : readRetail().catch(() => null),
    !denied && showInvoices ? listInvoices().catch(() => null) : [],
    !denied && active.id === "usuarios" ? getMongoDb().then((db) => db.collection<User>("users").find({}, {
      projection: { _id: 0, name: 1, email: 1, role: 1, disabled: 1, managed: 1, permissions: 1 },
    }).sort({ name: 1 }).toArray()).catch(() => null) : [],
  ]);

  const filter: Filter = storeList(state ?? undefined).find((store) => store.id === params.loja)?.id ?? "";

  const units = storeList(state ?? undefined);
  const colorStock = active.id === "simulador" && state ? productColorStock(state.stockLots) : {};
  const category = productCategories.find((item) => item === params.categoria);
  const stockView = stockViews.find(({ id }) => id === params.estoqueVisao)?.id ?? "produtos";
  const stockViewQuery = active.id === "estoque" ? "&" + new URLSearchParams({ estoqueVisao: stockView }) : "";
  const categoryQuery = (active.id === "estoque" || active.id === "compras") && category ? "&" + new URLSearchParams({ categoria: category }) : "";
  const supportsSearch = ["estoque", "compras", "produtos", "crm"].includes(active.id);
  const query = supportsSearch && typeof params.busca === "string" ? params.busca.trim().slice(0, 100) : "";
  const searchQuery = query ? "&" + new URLSearchParams({ busca: query }) : "";
  const heading = active.id === "lojas" && filter ? "Unidade " + storeName(filter, state ?? undefined) : active.label;

  const group = navGroups.find(({ tabs }) => tabs.includes(active.id))?.title ?? (active.id === "lojas" ? "Lojas" : undefined);
  const primary = moduleActions[active.id];
  const actionBesideUnits = active.id === "crm" || active.id === "estoque" || active.id === "compras" || active.id === "funcionarios" || active.id === "distribuicoes";
  const shortcuts = [
    ["vendas", "Nova venda", "Registrar cliente, produtos e pagamento"],
    ["compras", "Registrar compra", "Lançar fornecedor e entrada de produtos"],
    ["estoque", "Consultar estoque", "Ver saldos, lotes e movimentações"],
    ["crm", "Novo cliente", "Abrir uma ficha de atendimento"],
  ] as const;

  const sidebar = <aside className="sidebar">
      <Brand href="/admin" />
      <nav aria-label="Módulos do painel">{navGroups.map(({ title, tabs }) => {
        const items = tabs.flatMap((id) => visibleNav.filter((item) => item.id === id));
        return items.length > 0 && <div className="sidebar-group" key={title}>
          <p>{title}</p>{items.map((item) => item.id === "lojas" ? [
            { id: "", label: "Todas as lojas" },
            ...units.map((unit) => ({ id: unit.id, label: "Unidade " + unit.name })),
          ].map((unit) => <Link key={unit.id} aria-current={active.id === "lojas" && filter === unit.id ? "page" : undefined}
            href={adminUrl("lojas", unit.id)}><Icon name="pin" size={19} />{unit.label}</Link>) : <Link aria-current={active.id === item.id ? "page" : undefined} href={adminUrl(item.id, filter)} key={item.id}><Icon name={item.icon} size={19} />{item.label}</Link>)}
        </div>;
      })}</nav>
      <div className="sidebar-footer-actions">
        <Link className="sidebar-footer" href="/">Ver landing page <Icon name="external" size={16} /></Link>
        <SignOutDialog />
      </div>
    </aside>;

  return <div className="admin-shell">
    <div className="desktop-admin-menu">{sidebar}</div>
    <div className="admin-main">
      <div className="admin-top admin-mobile-toolbar"><MobileMenu>{sidebar}</MobileMenu></div>
      <main className="admin-content">
        {process.env.MUVIE_DEMO === "1" && <p className="feedback success">Ambiente de demonstração · os dados são fictícios e separados do banco da loja.</p>}
        <div className="admin-heading"><div><p className="eyebrow">{group}</p><h1>{denied ? "Acesso restrito" : heading}</h1><p>{denied ? "Sua conta não tem acesso ao módulo solicitado." : active.description}</p></div>
          {!denied && state && primary && !actionBesideUnits && active.id !== "produtos" && active.id !== "taxas" && active.id !== "compromissos" && <a className="button yellow" href={"#" + primary.target}>＋ {primary.label}</a>}
          {!denied && state && (active.id === "produtos" || active.id === "taxas") && primary && <div className="admin-filter-bar">
            <a className="button yellow" href={"#" + primary.target}>＋ {primary.label}</a>
          </div>}
          {!denied && state && active.id === "lojas" && !filter && <UnitDialog />}
          {!denied && !["lojas", "taxas", "impostos", "usuarios", "logs", "relatos", "catalogo", "produtos", "simulador", "fornecedores"].includes(active.id) && <div className={"admin-filter-bar" + (actionBesideUnits ? " crm-filter-bar" : "")}>
            {actionBesideUnits && state && primary && <a className="button yellow" href={"#" + primary.target}>＋ {primary.label}</a>}
            <div className="unit-filter"><span>Unidade</span><nav className="branch-filter" aria-label="Filtrar por unidade">
            <Link aria-current={!filter ? "true" : undefined} href={adminUrl(active.id) + periodQuery + categoryQuery + searchQuery + stockViewQuery + commitmentQuery}>Todas</Link>
            {storeList(state ?? undefined).map((store) => <Link aria-current={filter === store.id ? "true" : undefined} href={adminUrl(active.id, store.id) + periodQuery + categoryQuery + searchQuery + stockViewQuery + commitmentQuery} key={store.id}>{store.name}</Link>)}
          </nav></div></div>}
          {!denied && state && active.id === "compromissos" && primary && <div className="admin-filter-bar">
            <a className="button yellow" href={"#" + primary.target}>＋ {primary.label}</a>
          </div>}
        </div>
        {params.ok && <p className="feedback success" role="status">{params.ok}</p>}
        {params.erro && <p className="feedback error" role="alert">{params.erro}</p>}
        {state && !invoices && <p className="feedback error" role="alert">Não foi possível carregar os anexos de notas fiscais.</p>}
        {denied ? <Link className="back-link" href={adminUrl(active.id)}>Abrir {active.label} →</Link> : !state ? <p className="feedback error" role="alert">Não foi possível ler o banco de dados local. Confira a conexão com o MongoDB.</p> : <>
          {active.id === "visao" && <>
            {shortcuts.some(([id]) => canAccess(user, id)) && <section className="panel">
              <div className="panel-title"><h2>Ações rápidas</h2></div>
              <div className="workspace-shortcuts">{shortcuts.filter(([id]) => canAccess(user, id)).map(([id, label, description]) => {
                const target = id === "estoque" ? "" : "#" + moduleActions[id]?.target;
                return <Link href={adminUrl(id, filter) + target} key={id}><strong>{label}</strong><small>{description}</small><Icon name="arrow" size={16} /></Link>;
              })}</div>
            </section>}
            <Rankings state={state} filter={filter} period={period} admin={canAccess(user, "financeiro")} />{canAccess(user, "consignados") && <Consignment state={state} filter={filter} /> }<Overview state={state} filter={filter} showSales={showSales} />
            {(canAccess(user, "estoque") || canAccess(user, "consignados")) && <InventoryOverview state={state} filter={filter} showCost={canAccess(user, "financeiro") || showPurchases} />}
            {invoices && (showSales || showPurchases) && <InvoiceOverview state={state} invoices={invoices} filter={filter} sales={showSales} purchases={showPurchases} />}
          </>}
          {active.id === "produtos" && <Products category={category} focus={params.ficha} error={params.erro} query={query} products={state.products.filter((item) => (!category || item.category === category) && matchesSearch(query, item.name, item.sku, item.category))} filter={filter} />}
          {active.id === "catalogo" && <CatalogSettings requestedPage={params.catalogoPagina} state={state} showProducts={canAccess(user, "produtos")} />}
          {active.id === "consignados" && <Consignment state={state} filter={filter} detailed showPurchases={showPurchases} />}
          {active.id === "estoque" && <Stock view={stockView} error={params.erro} balancePage={params.saldosPagina} lotPage={params.lotesPagina}
            query={query} movementPage={params.movimentosPagina} state={state} filter={filter} category={category} showPurchases={showPurchases} />}
          {active.id === "compras" && <Purchases canCancel={user.role === "admin" || isPrimaryAdmin(user)} canCreateProduct={canAccess(user, "produtos")} category={category} error={params.erro} query={query} state={state} filter={filter} invoices={invoices ?? []} focus={params.ficha} productId={params.produto} />}
          {active.id === "vendas" && <>
            <Sales canEditCosts={user.role === "admin" || isPrimaryAdmin(user)} detailFeedback={params.erro ? { message: params.erro, error: true } : params.ok ? { message: params.ok, error: false } : undefined} saleFilter={params.statusVenda} showCost={canAccess(user, "financeiro")} state={state} filter={filter} invoices={invoices} focus={params.ficha} error={params.ficha && !state.sales.some((sale) => sale.id === params.ficha) ? params.erro : undefined} />
          </>}
          {active.id === "lojas" && <StoresPanel state={state} filter={filter} showSales={showSales} />}
          {active.id === "distribuicoes" && <ProfitDistributions state={state} filter={filter} error={params.erro} />}
          {active.id === "bens" && <CompanyAssets state={state} filter={filter} showSales={showSales} invoices={invoices ?? []} focus={params.ficha} error={params.erro} success={params.ok} />}
          {active.id === "fornecedores" && <Suppliers suppliers={state.suppliers} focus={params.ficha} error={params.erro} success={params.ok} />}
          {active.id === "funcionarios" && <StaffPanel state={state} filter={filter} focus={params.ficha} error={params.erro} success={params.ok} />}
          {active.id === "financeiro" && <Finance state={state} filter={filter} period={period} />}
          {active.id === "compromissos" && <Commitments view={commitmentView} paidFrom={paidFrom} paidTo={paidTo} requestedPage={params.compromissosPagina} kind={commitmentKind} deadline={commitmentDeadline} state={state} filter={filter} createError={params.ficha ? params.erro : undefined} />}
          {active.id === "crm" && <CRM query={query} stage={params.etapa} error={params.erro} success={params.ok} state={state} filter={filter} invoices={invoices ?? []} focus={params.ficha} showSales={showSales} showPurchases={showPurchases} />}
          {active.id === "simulador" && <Simulator stores={storeList(state)} key={filter} initialStore={filter || "sao-jose"} rates={state.cardRates} machines={state.cardMachines} taxRates={state.taxRates ?? []} showFinance={canAccess(user, "financeiro")}
            lots={canAccess(user, "financeiro") ? state.stockLots.map(({ productId, store, date, quantity, unitCost, color }) => ({ productId, store, date, quantity, unitCost, color })) : []}
            sellers={canAccess(user, "financeiro") ? state.staff.filter((seller) => seller.active).map(({ id, name, store, commissionBps }) => ({ id, name, store, commissionBps })) : []}
            products={state.products.map(({ id, name, sku, price, stock }) => ({ id, name, sku, price, stock, colorStock: colorStock[id] }))} />}
          {active.id === "taxas" && <CardSettings canManage={user.role === "admin" || isPrimaryAdmin(user)} state={state} machineId={params.maquininha} error={params.erro} />}
          {active.id === "impostos" && <TaxSettings rates={state.taxRates ?? []} />}
          {active.id === "relatos" && <TestimonialsSettings state={state} />}
          {active.id === "usuarios" && (users ? <UsersPanel users={users} actor={user} /> : <p role="alert">Não foi possível carregar os usuários.</p>)}
          {active.id === "logs" && <section className="panel"><div className="panel-title"><h2>Atividade da equipe</h2><span className="pill">Últimas 200 na tela</span></div>
            {state.audit.length ? <Table headers={["Data", "Usuário", "Ação"]}>{state.audit.slice(0, 200).map((entry) => <tr key={entry.id}>
              <td>{dateLabel(entry.at)}</td><td>{entry.actor}</td><td>{entry.action}</td>
            </tr>)}</Table> : <Empty>As novas operações serão registradas aqui.</Empty>}
          </section>}
        </>}
      </main>
    </div>
  </div>;
}
