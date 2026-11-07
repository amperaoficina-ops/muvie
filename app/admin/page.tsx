import { randomUUID } from "node:crypto";
import Link from "next/link";
import Image from "next/image";
import { Brand, Icon } from "../brand";
import { signOut } from "../login/actions";
import { requireUser, type User } from "@/lib/auth";
import { getMongoDb } from "@/lib/mongodb";
import { listInvoices, type InvoiceMeta, type InvoiceOwner } from "@/lib/invoices";
import { readRetail } from "@/lib/retail-store";
import {
  balanceDue, money, paymentMethods, stages, storeName, stores,
  type Contact, type Product, type RetailState, type Sale, type StoreId,
} from "@/domain/retail";
import { attachInvoice, reverseSale, saveContact, saveProduct, savePurchase, saveSale, updateStock } from "./actions";
import { scooterFields } from "@/domain/scooter";
import { ProductCategoryFields, PurchaseProductFields } from "./scooter-fields";
import { Submit } from "./submit";
import { CardSettings, Charts, TestimonialsSettings, UsersPanel } from "./operations";
import { Simulator } from "./simulator";
import { Finance, Rankings, reportPeriod, StoresPanel } from "./finance";
import { canAccess } from "@/domain/access";

const nav = [
  { id: "visao", label: "Visão geral", icon: "grid", description: "Acompanhe o estoque, as vendas e os atendimentos das suas lojas." },
  { id: "produtos", label: "Produtos", icon: "box", description: "Cadastre scooters, peças e acessórios e escolha o que aparece na landing page." },
  { id: "estoque", label: "Estoque", icon: "box", description: "Consulte saldos, registre movimentações e transfira produtos entre as duas lojas." },
  { id: "compras", label: "Compras", icon: "bag", description: "Registre compras, dê entrada na unidade correta e organize as notas de fornecedores." },
  { id: "vendas", label: "Vendas", icon: "bag", description: "Registre vendas por unidade e acompanhe o histórico de cada operação." },
  { id: "financeiro", label: "Financeiro", icon: "grid", description: "Acompanhe DRE, caixa, contas a pagar e a receber por unidade.", admin: true },
  { id: "lojas", label: "Administração das lojas", icon: "pin", description: "Configure equipe, custos fixos e estrutura de São José e Palhoça.", admin: true },
  { id: "crm", label: "Clientes / CRM", icon: "users", description: "Consulte fichas, histórico de compras e vendas, documentos e retornos por unidade." },
  { id: "simulador", label: "Simular venda", icon: "bolt", description: "Monte uma proposta de cartão durante o atendimento com produtos em estoque." },
  { id: "taxas", label: "Taxas de cartão", icon: "bag", description: "Cadastre e ajuste as condições de débito e crédito das maquininhas.", admin: true },
  { id: "usuarios", label: "Usuários", icon: "users", description: "Gerencie o acesso da equipe de atendimento.", admin: true },
  { id: "logs", label: "Log de ações", icon: "grid", description: "Confira as operações registradas e quem as realizou.", admin: true },
  { id: "relatos", label: "Relatos da landing", icon: "users", description: "Organize os relatos autorizados exibidos no site.", admin: true },
] as const;
type Tab = typeof nav[number]["id"];
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

function StoreField({ filter, label = "Unidade" }: { filter: Filter; label?: string }) {
  return <label>{label}<select name="store" defaultValue={filter} required><option value="" disabled>Selecione a unidade</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>;
}

function ProductField({ products }: { products: Product[] }) {
  return <label>Produto<select name="productId" defaultValue="" required><option value="" disabled>Selecione um produto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select></label>;
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
    <h3>Notas fiscais</h3>
    <InvoiceLinks invoices={invoices.filter((invoice) => invoice.owner === owner && invoice.ownerId === id)} />
    <form action={attachInvoice} className="invoice-form">
      <FilterInput filter={filter} />
      <input type="hidden" name="owner" value={owner} />
      <input type="hidden" name="ownerId" value={id} />
      <input type="hidden" name="focus" value={id} />
      {owner === "client" && <label>Tipo de nota<select name="kind"><option>Venda</option><option>Compra</option></select></label>}
      <label>Arquivo (PDF ou XML, até 8 MB)<input type="file" name="invoice" accept=".pdf,.xml" required /></label>
      <div><Submit>Anexar nota fiscal</Submit></div>
    </form>
  </section>;
}

function Overview({ state, filter, showSales }: { state: RetailState; filter: Filter; showSales: boolean }) {
  const sales = state.sales.filter((sale) => !sale.canceledAt && (!filter || sale.store === filter));
  const contacts = state.contacts.filter((contact) => (!filter || contact.store === filter) && !["Ganho", "Perdido"].includes(contact.stage));
  const stock = (store: StoreId) => state.products.reduce((total, product) => total + product.stock[store], 0);
  const metrics = [
    { label: "Vendas registradas", value: sales.length, detail: "Vendas ativas no histórico", icon: "bag" },
    { label: "Valor em vendas", value: money(sales.reduce((sum, sale) => sum + sale.total, 0)), detail: "Total líquido de descontos", icon: "bolt" },
    { label: "Unidades em estoque", value: filter ? stock(filter) : stock("sao-jose") + stock("palhoca"), detail: state.products.length + " produtos no catálogo interno", icon: "box" },
    { label: "Atendimentos abertos", value: contacts.length, detail: "Contatos em acompanhamento", icon: "users" },
  ] as const;
  return <>
    <div className="metrics-grid">{metrics.map((item) => <article key={item.label} className="metric panel"><span className="metric-icon"><Icon name={item.icon} size={19} /></span><p>{item.label}</p><strong>{item.value}</strong><small>{item.detail}</small></article>)}</div>
    <Charts state={state} filter={filter} />
    <div className="overview-grid">
      {showSales && <section className="panel"><div className="panel-title"><h2>Vendas recentes</h2><Link className="back-link" href={adminUrl("vendas", filter)}>Ver vendas →</Link></div>
        {sales.length ? <SalesTable sales={sales.slice(0, 5)} filter={filter} /> : <Empty>As vendas registradas nesta unidade aparecerão aqui.</Empty>}
      </section>}
      <section className="panel"><div className="panel-title"><h2>Suas unidades</h2><span className="pill">02 LOJAS</span></div>
        <div className="branch-list">{stores.map((store) => <Link href={adminUrl("visao", store.id)} key={store.id}><span className="metric-icon"><Icon name="pin" size={18} /></span><span><strong>{store.name}</strong><small>{stock(store.id)} unidades em estoque</small></span><Icon name="arrow" size={17} /></Link>)}</div>
      </section>
    </div>
  </>;
}

function ProductForm({ filter, product }: { filter: Filter; product?: Product }) {
  return <form className="admin-form" action={saveProduct}>
    <FilterInput filter={filter} />{product && <input type="hidden" name="id" value={product.id} />}
    <label>Nome<input name="name" required maxLength={100} defaultValue={product?.name} placeholder="Nome comercial" /></label>
    <label>SKU<input name="sku" required maxLength={40} defaultValue={product?.sku} placeholder="Código do produto" /></label>
    <ProductCategoryFields product={product && { category: product.category, specs: product.specs }} />
    <label>Preço de venda (R$)<input name="price" type="number" min="0" max="99999999.99" step=".01" defaultValue={product ? product.price / 100 : ""} placeholder="0,00" /></label>
    <label>Custo unitário de referência (R$)<input name="purchaseCost" type="number" min="0" max="99999999.99" step=".01" defaultValue={product?.purchaseCost != null ? product.purchaseCost / 100 : ""} placeholder="Opcional" /></label>
    {product?.imageUrl && <div className="product-photo-preview span-two">
      <Image src={product.imageUrl} alt={product.name} width={96} height={72} unoptimized />
      <label className="checkbox"><input name="removePhoto" type="checkbox" /> Retirar a foto atual</label>
    </div>}
    <label className="span-two">{product?.imageUrl ? "Substituir foto" : "Foto do produto"}<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" /><small>JPG, PNG ou WebP, até 5 MB.</small></label>
    <label className="span-two">Descrição<textarea name="description" rows={2} maxLength={350} defaultValue={product?.description} /></label>
    <label className="checkbox span-two"><input type="checkbox" name="published" defaultChecked={product?.published} /> Exibir este produto na landing page</label>
    <div className="span-two"><Submit>{product ? "Salvar alterações" : "Cadastrar produto"}</Submit></div>
  </form>;
}

function Products({ products, filter }: { products: Product[]; filter: Filter }) {
  return <div className="operation-grid"><section className="panel">
    <div className="panel-title"><h2>Produtos cadastrados</h2><span className="pill">{products.length} no catálogo</span></div>
    {products.length ? <div className="editable-list">{products.map((product) => <details key={product.id}>
      <summary><span><strong>{product.name}</strong><small>{product.sku} · {product.category}{product.purchaseCost != null && " · Custo ref. " + money(product.purchaseCost)}</small></span><span className="pill">{product.published ? "Na landing" : "Interno"}</span><strong>{money(product.price)}</strong></summary>
      <ProductForm product={product} filter={filter} />
      <div className="record-actions"><Link className="back-link" href={adminUrl("compras", filter) + "&produto=" + product.id}>Registrar compra deste produto →</Link></div>
    </details>)}</div> : <Empty>Cadastre seu primeiro produto para liberar movimentações e vendas.</Empty>}
  </section><section className="panel"><div className="panel-title"><h2>Novo produto</h2></div><ProductForm filter={filter} /></section></div>;
}

function Purchases({ state, filter, invoices, focus, productId }: {
  state: RetailState; filter: Filter; invoices: InvoiceMeta[]; focus?: string; productId?: string;
}) {
  const purchases = state.purchases.filter((purchase) => !filter || purchase.store === filter);
  const product = state.products.find((item) => item.id === productId);
  const purchaseId = randomUUID();
  return <div className="operation-grid">
    <section className="panel">
      <div className="panel-title"><h2>Histórico de compras</h2><span className="pill">{purchases.length} compras</span></div>
      {purchases.length ? <div className="editable-list">{purchases.map((purchase) => (
        <details key={purchase.id} open={focus === purchase.id}>
          <summary><span><strong>{purchase.productName}</strong><small>{calendarLabel(purchase.date)} · {storeName(purchase.store)} · {purchase.supplier}</small></span>
            <span className="pill">{purchaseStatus(state, purchase.id, purchase.acquisition)}</span><strong>{money(purchase.total)}</strong></summary>
          <div className="record-actions">
            <p>{purchase.sku} · {purchase.quantity} un. × {money(purchase.unitCost)}</p>
            {purchase.invoiceNumber && <p>Nota fiscal nº {purchase.invoiceNumber}</p>}
            {purchase.notes && <p>{purchase.notes}</p>}
            {purchase.specs && <dl className="purchase-specs">{scooterFields.filter(({ key }) => purchase.specs?.[key]).map(({ key, label }) => (
              <div key={key}><dt>{label}</dt><dd>{purchase.specs?.[key]}</dd></div>
            ))}</dl>}
          </div>
          <InvoiceBox owner="purchase" id={purchase.id} filter={filter} invoices={invoices} />
        </details>
      ))}</div> : <Empty>As compras registradas nesta unidade aparecerão aqui.</Empty>}
    </section>
    <section className="panel">
      <div className="panel-title"><h2>Registrar compra</h2></div>
      {state.products.length ? <form action={savePurchase} className="admin-form">
        <FilterInput filter={filter} />
        <input type="hidden" name="purchaseId" value={purchaseId} />
        <input type="hidden" name="focus" value={purchaseId} />
        <PurchaseProductFields initialId={product?.id} products={state.products.map(({ id, name, sku, category, specs, purchaseCost }) => ({ id, name, sku, category, specs, purchaseCost }))} />
        <StoreField filter={filter} label="Unidade que recebe o estoque" />
        <label>Fornecedor<input name="supplier" maxLength={100} placeholder="Nome ou razão social" /></label>
        <label>Cliente vinculado (opcional)<select name="contactId"><option value="">Sem vínculo</option>{state.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name} · {storeName(contact.store)}</option>)}</select></label>
        <label>Quantidade<input name="quantity" type="number" min="1" max="999999" defaultValue="1" required /></label>

        <label>Data da compra<input name="date" type="date" defaultValue={new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date())} required /></label>
        <label>Número da nota (opcional)<input name="invoiceNumber" maxLength={44} /></label>
        <label>Condição da compra<select name="acquisition" defaultValue="" required>
          <option value="" disabled>Selecione a condição</option><option value="quitada">Já quitada</option><option value="a-pagar">A pagar</option><option value="consignada">Consignada</option>
        </select></label>
        <label>Vencimento (se a pagar)<input name="due" type="date" /></label>
        <label className="span-two">Observações<textarea name="notes" rows={2} maxLength={500} /></label>
        <p className="form-note span-two">Ao registrar, o estoque recebe a quantidade automaticamente. Anexe a nota no histórico após salvar.</p>
        <div className="span-two"><Submit>Registrar compra</Submit></div>
      </form> : <Empty><Link href={adminUrl("produtos", filter)}>Cadastre um produto para registrar compras →</Link></Empty>}
    </section>
  </div>;
}

function purchaseStatus(state: RetailState, id: string, condition?: string) {
  if (condition === "consignada") return "Consignada";
  if (condition === "quitada") return "Quitada";
  if (condition === "a-pagar") {
    const entry = state.ledger.find((item) => item.id === id + "-payable");
    return entry && balanceDue(entry) === 0 ? "Quitada" : "A pagar";
  }
  return "Histórico sem classificação";
}

function Stock({ state, filter }: { state: RetailState; filter: Filter }) {
  const columns = stores.filter((store) => !filter || filter === store.id);
  const movements = state.movements.filter((movement) => !filter || movement.store === filter);
  const lots = state.stockLots.filter((item) => item.quantity > 0 && (!filter || item.store === filter));
  return <>
    <div className="operation-grid">
      <section className="panel"><div className="panel-title"><h2>Saldos por unidade</h2></div>
        {state.products.length ? <Table headers={["Produto", ...columns.map((store) => store.name)]}>{state.products.map((product) => <tr key={product.id}><td><strong>{product.name}</strong><small>{product.sku}</small></td>{columns.map((store) => <td key={store.id}>{product.stock[store.id]} un.</td>)}</tr>)}</Table> : <Empty>Cadastre um produto para movimentar o estoque.</Empty>}
      </section>
      <section className="panel"><div className="panel-title"><h2>Movimentar estoque</h2></div>
        {state.products.length ? <form action={updateStock} className="admin-form">
          <FilterInput filter={filter} /><ProductField products={state.products} /><StoreField filter={filter} label="Unidade de origem ou ajuste" />
          <label>Operação<select name="mode"><option value="entrada">Entrada</option><option value="saida">Saída</option><option value="transferencia">Transferir para a outra loja</option></select></label>
          <label>Quantidade<input name="quantity" type="number" min="1" max="999999" defaultValue="1" required /></label>
          <label className="span-two">Motivo da entrada ou saída<input name="reason" maxLength={100} placeholder="Ex.: recebimento de fornecedor" /></label>
          <div className="span-two"><Submit>Registrar movimentação</Submit></div>
        </form> : <Empty><Link href={adminUrl("produtos", filter)}>Ir para Produtos →</Link></Empty>}
      </section>
    </div>
    <section className="panel"><div className="panel-title"><h2>Lotes em estoque · origem e condição</h2></div>
      {lots.length ? <Table headers={["Produto", "Unidade", "Fornecedor", "Condição", "Saldo"]}>{lots.map((lot) => {
        const purchase = state.purchases.find((item) => item.id === lot.purchaseId);
        return <tr key={lot.purchaseId + lot.store}><td>{state.products.find((item) => item.id === lot.productId)?.name ?? lot.productId}</td><td>{storeName(lot.store)}</td>
          <td>{lot.supplier}</td><td>{purchaseStatus(state, lot.purchaseId, purchase?.acquisition)}</td><td>{lot.quantity} un.</td></tr>;
      })}</Table> : <Empty>Os lotes aparecem conforme você registra as compras.</Empty>}
      <p className="admin-empty">Saldos manuais e registros anteriores podem aparecer no saldo geral sem lote associado.</p>
    </section>
    <section className="panel"><div className="panel-title"><h2>Histórico de movimentações</h2></div>
      {movements.length ? <Table headers={["Data", "Produto", "Unidade", "Movimento", "Quantidade"]}>{movements.map((movement) => <tr key={movement.id}><td>{dateLabel(movement.createdAt)}</td><td>{movement.productName}</td><td>{storeName(movement.store)}</td><td>{movement.reason}</td><td>{movement.quantity > 0 ? "+" : ""}{movement.quantity}</td></tr>)}</Table> : <Empty>O histórico desta unidade está vazio.</Empty>}
    </section>
  </>;
}

function SalesTable({ sales, filter, canCancel = false, invoices = [], focus }: { sales: Sale[]; filter: Filter; canCancel?: boolean; invoices?: InvoiceMeta[]; focus?: string }) {
  return <Table headers={["Venda", "Unidade", "Total", "Status", ...(canCancel ? ["Ação"] : [])]}>{sales.map((sale) =>
    <tr key={sale.id}>
      <td><strong>{sale.customer}</strong><small>{sale.quantity} × {sale.productName} · {dateLabel(sale.createdAt)}</small>{sale.sellerName && <small>Vendedor: {sale.sellerName}</small>}</td>
      <td>{storeName(sale.store)}</td><td><strong>{money(sale.total)}</strong><small>{sale.method}</small></td>
      <td><span className={"pill " + (sale.canceledAt ? "" : "green")}>{sale.canceledAt ? "Cancelada" : "Registrada"}</span></td>
      {canCancel && <td><details className="sale-documents" open={focus === sale.id}><summary>Notas fiscais</summary>
        <InvoiceBox owner="sale" id={sale.id} filter={filter} invoices={invoices} />
      </details>{!sale.canceledAt && <details className="cancel-sale"><summary>Cancelar</summary>
        <form action={reverseSale}><FilterInput filter={filter} /><input type="hidden" name="saleId" value={sale.id} />
          <p>As unidades voltam ao estoque de {storeName(sale.store)}.</p>
          <label className="checkbox"><input type="checkbox" name="refund" /> Já devolvi o valor recebido, se houver</label>
          <Submit variant="danger">Confirmar</Submit>
        </form></details>}</td>}
    </tr>)}</Table>;
}

function Sales({ state, filter, invoices, focus }: { state: RetailState; filter: Filter; invoices: InvoiceMeta[]; focus?: string }) {
  const sales = state.sales.filter((sale) => !filter || sale.store === filter);
  const contacts = state.contacts.filter((contact) => !filter || contact.store === filter);
  const products = state.products.filter((product) => product.price > 0 && (filter ? product.stock[filter] > 0 : stores.some((store) => product.stock[store.id] > 0)));
  const saleId = randomUUID();
  return <div className="operation-grid">
    <section className="panel"><div className="panel-title"><h2>Histórico de vendas</h2></div>{sales.length ? <SalesTable sales={sales} filter={filter} canCancel invoices={invoices} focus={focus} /> : <Empty>Nenhuma venda registrada para este filtro.</Empty>}</section>
    <section className="panel"><div className="panel-title"><h2>Nova venda</h2></div>
      {products.length ? <form className="admin-form" action={saveSale}>
        <FilterInput filter={filter} /><input type="hidden" name="saleId" value={saleId} /><input type="hidden" name="focus" value={saleId} />
        <StoreField filter={filter} /><ProductField products={products} />
        <label>Cliente<input name="customer" maxLength={100} placeholder="Nome do cliente" /></label>
        <label>Cliente cadastrado<select name="contactId"><option value="">Sem vínculo</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name} · {storeName(contact.store)}</option>)}</select></label>
        <label>Quantidade<input name="quantity" type="number" min="1" max="999999" defaultValue="1" required /></label>
        <label>Desconto em reais<input name="discount" type="number" min="0" step=".01" placeholder="0,00" /></label>
        <label className="span-two">Forma de pagamento<select name="method">{paymentMethods.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Vendedor da unidade<select name="sellerId"><option value="">Sem vendedor</option>
          {state.staff.filter((item) => item.active && (!filter || item.store === filter)).map((item) => <option key={item.id} value={item.id}>{item.name} · {storeName(item.store)}</option>)}
        </select></label>
        <label>Recebimento<select name="receive" defaultValue="" required><option value="" disabled>Selecione</option><option value="received">Já recebido</option><option value="pending">A receber</option></select></label>
        <label>Vencimento (se a receber)<input name="due" type="date" /></label>
        <label className="span-two">Origem do estoque<select name="origin"><option value="">Automática · lote mais antigo</option><option value="legacy">Saldo avulso / sem lote</option>
          {state.stockLots.filter((lot) => lot.quantity > 0 && (!filter || lot.store === filter)).map((lot) => <option key={lot.purchaseId + lot.store} value={lot.purchaseId}>
            {state.products.find((item) => item.id === lot.productId)?.name} · {storeName(lot.store)} · {lot.consigned ? "Consignada" : "Própria"} · {lot.supplier} · {calendarLabel(lot.date)} · {lot.quantity} un.
          </option>)}
        </select><small>Quando houver estoque próprio e consignado do mesmo modelo, escolha a origem da moto vendida.</small></label>
        <div className="span-two"><Submit>Registrar venda</Submit></div>
      </form> : <Empty>Para registrar uma venda, cadastre um produto com preço e adicione saldo à unidade em <Link href={adminUrl("estoque", filter)}>Estoque</Link>.</Empty>}
    </section>
  </div>;
}

function ContactForm({ filter, contact }: { filter: Filter; contact?: Contact }) {
  return <form className="admin-form" action={saveContact}>
    <FilterInput filter={filter} />{contact && <><input type="hidden" name="id" value={contact.id} /><input type="hidden" name="focus" value={contact.id} /></>}
    <label>Nome<input name="name" maxLength={100} defaultValue={contact?.name} required /></label>
    <label>Telefone<input name="phone" type="tel" maxLength={32} defaultValue={contact?.phone} /></label>
    <label>E-mail<input name="email" type="email" maxLength={254} defaultValue={contact?.email} /></label>
    <label>CPF<input name="cpf" inputMode="numeric" maxLength={20} defaultValue={contact?.cpf} placeholder="000.000.000-00" /></label>
    <label>Data de nascimento<input name="birthDate" type="date" min="1900-01-01" defaultValue={contact?.birthDate} /></label>
    <StoreField filter={contact?.store ?? filter} />
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
    <label>Etapa<select name="stage" defaultValue={contact?.stage ?? stages[0]}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
    <label>Interesse<input name="interest" maxLength={100} defaultValue={contact?.interest} placeholder="Modelo ou necessidade" /></label>
    <label>Próximo retorno<input name="nextContact" type="date" defaultValue={contact?.nextContact} /></label>
    <label className="span-two">Observações<textarea name="notes" rows={2} maxLength={500} defaultValue={contact?.notes} /></label>
    <div className="span-two"><Submit>{contact ? "Salvar ficha" : "Cadastrar cliente"}</Submit></div>
  </form>;
}

function CRM({ state, filter, invoices, focus, showSales, showPurchases }: {
  state: RetailState; filter: Filter; invoices: InvoiceMeta[]; focus?: string; showSales: boolean; showPurchases: boolean;
}) {
  const list = state.contacts.filter((contact) => !filter || contact.store === filter);
  return <>
    <div className="pipeline">{stages.map((stage) => <article className="panel" key={stage}><p>{stage}</p><strong>{list.filter((item) => item.stage === stage).length}</strong></article>)}</div>
    <div className="operation-grid"><section className="panel"><div className="panel-title"><h2>Clientes e oportunidades</h2></div>
      {list.length ? <div className="editable-list">{list.map((contact) => <details key={contact.id} open={focus === contact.id}>
        <summary><span><strong>{contact.name}</strong><small>{storeName(contact.store)}{contact.interest ? " · " + contact.interest : ""}{contact.nextContact ? " · Retorno " + contact.nextContact.split("-").reverse().join("/") : ""}</small></span><span className="pill">{contact.stage}</span></summary>
        <ContactForm filter={filter} contact={contact} />
        <InvoiceBox owner="client" id={contact.id} filter={filter} invoices={invoices} />
        {(showSales || showPurchases) && <section className="invoice-box"><h3>Histórico vinculado</h3>
          <ClientHistory state={state} contact={contact} invoices={invoices} showSales={showSales} showPurchases={showPurchases} />
        </section>}
      </details>)}</div> : <Empty>Adicione um contato para acompanhar a próxima conversa ou proposta.</Empty>}
    </section><section className="panel"><div className="panel-title"><h2>Novo cliente</h2></div><ContactForm filter={filter} /></section></div>
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
      ...purchase, date: calendarLabel(purchase.date), kind: "Compra", tab: "compras" as const, owner: "purchase", canceled: false,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!records.length) return <p className="form-note">Compras e vendas vinculadas a este cliente aparecem aqui.</p>;
  return <ul className="client-history">{records.map((record) => <li key={record.id}>
    <Link className="back-link" href={adminUrl(record.tab, record.store) + "&ficha=" + record.id}>{record.kind} · {record.productName}</Link>
    <p>{record.date} · {storeName(record.store)} · {money(record.total)}{record.canceled && " · Cancelada"}</p>
    <InvoiceLinks invoices={invoices.filter((invoice) => invoice.owner === record.owner && invoice.ownerId === record.id)} />
  </li>)}</ul>;
}

export const metadata = { title: "Painel de operação" };

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string; loja?: string; ok?: string; erro?: string; ficha?: string; produto?: string; inicio?: string; fim?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const visibleNav = nav.filter((item) => canAccess(user, item.id));
  const requested = nav.find((item) => item.id === params.tab);
  const denied = !!requested && !canAccess(user, requested.id);
  const active = (denied ? undefined : requested) ?? visibleNav[0];
  if (!active) return <main className="admin-content"><h1>Acesso ao painel</h1><p>Nenhum módulo está liberado para esta conta.</p><form action={signOut}><button className="button yellow">Sair</button></form></main>;
  const showSales = canAccess(user, "vendas");
  const showPurchases = canAccess(user, "compras");
  const filter: Filter = stores.find((store) => store.id === params.loja)?.id ?? "";
  const period = reportPeriod(params.inicio, params.fim);
  const periodQuery = active.id === "financeiro" || active.id === "visao" ? "&" + new URLSearchParams({ inicio: period.from, fim: period.to }) : "";
  const showInvoices = ["compras", "vendas", "crm"].includes(active.id);
  const [state, invoices, users] = await Promise.all([
    denied ? null : readRetail().catch(() => null),
    !denied && showInvoices ? listInvoices().catch(() => null) : [],
    !denied && active.id === "usuarios" ? getMongoDb().then((db) => db.collection<User>("users").find({}, {
      projection: { _id: 0, name: 1, email: 1, role: 1, disabled: 1, managed: 1, permissions: 1 },
    }).sort({ name: 1 }).toArray()).catch(() => null) : [],
  ]);

  return <div className="admin-shell">
    <aside className="sidebar">
      <Brand href="/admin" /><span className="sidebar-label">GESTÃO DA LOJA</span>
      <nav aria-label="Módulos do painel">{visibleNav.map((item) => <Link aria-current={active.id === item.id ? "page" : undefined} href={adminUrl(item.id, filter)} key={item.id}><Icon name={item.icon} size={19} />{item.label}</Link>)}</nav>
      <Link className="sidebar-footer" href="/">Ver landing page <Icon name="external" size={16} /></Link>
    </aside>
    <div className="admin-main">
      <header className="admin-top"><p><span>MUVI-E</span> / Gestão de loja</p><div><span>{user.name}</span><form action={signOut}><button type="submit">Sair</button></form></div></header>
      <main className="admin-content">
        {process.env.MUVIE_DEMO === "1" && <p className="feedback success">Ambiente de demonstração · os dados são fictícios e separados do banco da loja.</p>}
        <div className="admin-heading"><div><p className="eyebrow">OPERAÇÃO MULTILOJA</p><h1>{denied ? "Acesso restrito" : active.label}</h1><p>{denied ? "Sua conta não tem acesso ao módulo solicitado." : active.description}</p></div>
          {!denied && !["taxas", "usuarios", "logs", "relatos", "simulador"].includes(active.id) && <nav className="branch-filter" aria-label="Filtrar por unidade">
            <Link aria-current={!filter ? "true" : undefined} href={adminUrl(active.id) + periodQuery}>Todas</Link>
            {stores.map((store) => <Link aria-current={filter === store.id ? "true" : undefined} href={adminUrl(active.id, store.id) + periodQuery} key={store.id}>{store.name}</Link>)}
          </nav>}
        </div>
        {params.ok && <p className="feedback success" role="status">{params.ok}</p>}
        {params.erro && <p className="feedback error" role="alert">{params.erro}</p>}
        {state && !invoices && <p className="feedback error" role="alert">Não foi possível carregar os anexos de notas fiscais.</p>}
        {denied ? <Link className="back-link" href={adminUrl(active.id)}>Abrir {active.label} →</Link> : !state ? <p className="feedback error" role="alert">Não foi possível ler o banco de dados local. Confira a conexão com o MongoDB.</p> : <>
          {active.id === "visao" && <><Rankings state={state} filter={filter} period={period} admin={canAccess(user, "financeiro")} /><Overview state={state} filter={filter} showSales={showSales} /></>}
          {active.id === "produtos" && <Products products={state.products} filter={filter} />}
          {active.id === "estoque" && <Stock state={state} filter={filter} />}
          {active.id === "compras" && <Purchases state={state} filter={filter} invoices={invoices ?? []} focus={params.ficha} productId={params.produto} />}
          {active.id === "vendas" && <Sales state={state} filter={filter} invoices={invoices ?? []} focus={params.ficha} />}
          {active.id === "lojas" && <StoresPanel state={state} filter={filter} showSales={showSales} />}
          {active.id === "financeiro" && <Finance state={state} filter={filter} period={period} />}
          {active.id === "crm" && <CRM state={state} filter={filter} invoices={invoices ?? []} focus={params.ficha} showSales={showSales} showPurchases={showPurchases} />}
          {active.id === "simulador" && <Simulator key={filter} initialStore={filter || "sao-jose"} rates={state.cardRates}
            products={state.products.map(({ id, name, sku, price, stock }) => ({ id, name, sku, price, stock }))} />}
          {active.id === "taxas" && <CardSettings state={state} />}
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
