import { money, stores, type CardRate, type RetailState, type StoreId } from "@/domain/retail";
import { saveRate, saveTestimonial, saveUser } from "./actions";
import { Submit } from "./submit";
import { isPrimaryAdmin, roles, type AccountAccess } from "@/domain/access";
import { AccessFields } from "./access-fields";

export function CardSettings({ state }: { state: RetailState }) {
  return <div className="operation-grid">
    <section className="panel"><div className="panel-title"><h2>Condições cadastradas</h2></div>
      {state.cardRates.length ? <div className="editable-list">{state.cardRates.map((rate) => <details key={rate.id}>
        <summary><span><strong>{rate.name}</strong><small>{rate.mode} · {rate.installments}×</small></span><strong>{(rate.basisPoints / 100).toLocaleString("pt-BR")}%</strong></summary>
        <RateForm rate={rate} />
      </details>)}</div> : <p className="admin-empty">Cadastre uma condição para cada bandeira ou faixa de parcelas que você quiser simular.</p>}
    </section>
    <section className="panel"><div className="panel-title"><h2>Nova taxa de maquininha</h2></div><RateForm /></section>
  </div>;
}

function RateForm({ rate }: { rate?: CardRate }) {
  return <form className="admin-form" action={saveRate}>
    <input type="hidden" name="id" value={rate?.id ?? ""} />
    <label className="span-two">Nome da condição<input name="name" defaultValue={rate?.name} maxLength={70} placeholder="Ex.: Maquininha A · Visa" required /></label>
    <label>Modalidade<select name="mode" defaultValue={rate?.mode ?? "Crédito"}><option>Crédito</option><option>Débito</option></select></label>
    <label>Parcelas<input name="installments" type="number" min="1" max="24" defaultValue={rate?.installments ?? 1} required /></label>
    <label>Taxa total (%)<input name="percent" type="number" min="0" max="99.99" step=".01" defaultValue={rate ? rate.basisPoints / 100 : ""} required /></label>
    <div className="span-two"><Submit>Salvar taxa</Submit></div>
  </form>;
}

export function TestimonialsSettings({ state }: { state: RetailState }) {
  return <div className="operation-grid">
    <section className="panel"><div className="panel-title"><h2>Relatos publicados</h2></div>
      {state.testimonials.length ? <div className="admin-form">{state.testimonials.map((item) => <div key={item.id} className="span-two">
        <p><strong>{item.author}</strong> · {item.quote}</p>
        <form action={saveTestimonial}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="remove" value="yes" /><button className="back-link">Retirar da landing</button></form>
      </div>)}</div> : <p className="admin-empty">Os relatos publicados por você aparecem na landing.</p>}
    </section>
    <section className="panel"><div className="panel-title"><h2>Publicar relato autorizado</h2></div>
      <form className="admin-form" action={saveTestimonial}>
        <label className="span-two">Nome de exibição<input name="author" maxLength={70} required /></label>
        <label className="span-two">Relato<textarea name="quote" rows={4} maxLength={320} required /></label>
        <div className="span-two"><Submit>Publicar na landing</Submit></div>
      </form>
    </section>
  </div>;
}

type TeamAccount = AccountAccess & { name: string; email: string; disabled?: boolean };

export function UsersPanel({ users, actor }: { users: TeamAccount[]; actor: TeamAccount }) {
  const primary = isPrimaryAdmin(actor);
  return <div className="operation-grid">
    <section className="panel"><div className="panel-title"><h2>Equipe da loja</h2></div>
      <div className="editable-list">{users.map((user) => {
        const protectedAccount = isPrimaryAdmin(user) || user.email === actor.email || (user.role === "admin" && !primary);
        return <details key={user.email}>
          <summary><span><strong>{user.name}</strong><small>{user.email} · {roles[user.role ?? "admin"]} · {user.disabled ? "Inativo" : "Ativo"}</small></span>
            <span className="pill">{protectedAccount ? "Protegido" : Array.isArray(user.permissions) ? "Personalizado" : "Padrão do cargo"}</span></summary>
          {protectedAccount ? <p className="admin-empty">O acesso desta conta fica protegido nesta sessão.</p> :
            <form className="admin-form" action={saveUser}>
              <input type="hidden" name="edit" value="yes" /><input type="hidden" name="email" value={user.email} />
              <label className="span-two">Nome<input name="name" required maxLength={100} defaultValue={user.name} /></label>
              <AccessFields account={user} allowAdmin={primary} />
              <label className="checkbox span-two"><input type="checkbox" name="active" defaultChecked={!user.disabled} /> Conta ativa</label>
              <div className="span-two"><Submit>Salvar acesso</Submit></div>
            </form>}
        </details>;
      })}</div>
    </section>
    <section className="panel"><div className="panel-title"><h2>Novo usuário</h2></div>
      <form className="admin-form" action={saveUser}>
        <label className="span-two">Nome<input name="name" required maxLength={100} /></label>
        <label className="span-two">E-mail<input name="email" type="email" required maxLength={254} /></label>
        <label className="span-two">Senha inicial<input name="password" type="password" minLength={12} maxLength={256} autoComplete="new-password" required /></label>
        <AccessFields allowAdmin={primary} />
        <div className="span-two"><Submit>Criar acesso</Submit></div>
      </form>
    </section>
  </div>;
}

export function Charts({ state, filter }: { state: RetailState; filter: StoreId | "" }) {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" });
  const end = Date.parse(today.format(new Date()) + "T00:00:00Z");
  const sales = state.sales.filter((sale) => !sale.canceledAt && (!filter || sale.store === filter));
  const weeks = Array.from({ length: 4 }, (_, index) => {
    const start = end - (27 - index * 7) * 86400000;
    const label = new Date(start).toISOString().slice(5, 10).split("-").reverse().join("/");
    const total = sales.filter((sale) => {
      const day = Date.parse(today.format(new Date(sale.createdAt)) + "T00:00:00Z");
      return day >= start && day < start + 7 * 86400000;
    }).reduce((sum, sale) => sum + sale.total, 0);
    return { label, total };
  });
  const stock = stores.filter((item) => !filter || item.id === filter).map((item) => ({
    label: item.name, total: state.products.reduce((sum, product) => sum + product.stock[item.id], 0),
  }));
  return <div className="overview-grid">
    <BarChart title="Vendas nos últimos 28 dias" subtitle="Valores agrupados por semana · líquidos de descontos" rows={weeks} format={money} />
    <BarChart title="Estoque por loja" subtitle="Unidades disponíveis agora" rows={stock} format={(value) => value + " un."} />
  </div>;
}

function BarChart({ title, subtitle, rows, format }: { title: string; subtitle: string; rows: { label: string; total: number }[]; format: (value: number) => string }) {
  const max = Math.max(1, ...rows.map((row) => row.total));
  return <section className="panel"><div className="panel-title"><h2>{title}</h2></div>
    <div className="bar-chart"><p className="form-note">{subtitle}</p>
      {rows.map((row) => <div className="bar-row" key={row.label}>
        <span>{row.label}</span><div className="bar-track" aria-hidden="true"><i style={{ width: (row.total / max * 100) + "%" }} /></div><strong>{format(row.total)}</strong>
      </div>)}
    </div>
  </section>;
}
