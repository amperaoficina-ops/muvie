import { CreateDialog, DetailsDialog } from "./sale-dialog";
import { randomUUID } from "node:crypto";
import { businessDate, money, storeList, storeName, type RetailState } from "@/domain/retail";
import { saveStaffAdvance } from "./actions";
import { StoreItemForm } from "./finance";
import { Submit } from "./submit";

export function StaffPanel({ state, filter, focus, error, success }: { state: RetailState; filter: string; focus?: string; error?: string; success?: string }) {
  const today = businessDate();
  const month = today.slice(0, 7);
  const staff = state.staff.filter((item) => !filter || item.store === filter);
  const sales = state.sales.filter((sale) => !sale.canceledAt && (!filter || sale.store === filter)
    && businessDate(new Date(sale.createdAt)).startsWith(month));
  const advances = state.staffAdvances ?? [];
  return <div className="sales-workspace">
    <CreateDialog id="novo-funcionario" title="Cadastrar funcionário" reopen={Boolean(error && !focus)}>
      {error && !focus && <p className="feedback error" role="alert">{error}</p>}
      <StoreItemForm kind="staff" store={filter} units={storeList(state)} staffPage />
    </CreateDialog>
    <section className="panel">
      <div className="panel-title"><h2>Equipe</h2><span className="pill">{month.split("-").reverse().join("/")}</span></div>
      <div className="table-wrap"><table>
        <thead><tr>{["Funcionário", "Unidade", "Fixo mensal", "Comissão", "Vendas do mês", "Vales do mês", "Ação"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{staff.map((employee) => {
          const sold = sales.filter((sale) => sale.sellerId === employee.id);
          const records = advances.filter((item) => item.staffId === employee.id && (!filter || item.store === filter));
          const monthAdvances = records.filter((item) => item.date.startsWith(month));
          return <tr key={employee.id}>
            <td><strong>{employee.name}</strong><small>{employee.job}{employee.active ? "" : " · Inativo"}</small></td>
            <td>{storeName(employee.store, state)}</td><td>{money(employee.salary)}</td>
            <td>{(employee.commissionBps / 100).toLocaleString("pt-BR")}%<small>{money(sold.reduce((sum, sale) => sum + (sale.commission ?? 0), 0))} no mês</small></td>
            <td>{money(sold.reduce((sum, sale) => sum + sale.total, 0))}<small>{sold.length} venda(s)</small></td>
            <td>{money(monthAdvances.reduce((sum, item) => sum + item.amount, 0))}</td>
            <td><DetailsDialog id={"funcionario-" + employee.id} title={employee.name} reopen={focus === employee.id}>
              <div className="sale-detail-content">
                {focus === employee.id && (error || success) && <p className={"feedback " + (error ? "error" : "success")} role={error ? "alert" : "status"}>{error || success}</p>}
                <section className="sale-detail-card">
                  <h3>Dados do funcionário</h3><p>{storeName(employee.store, state)}</p>
                  <StoreItemForm kind="staff" item={employee} store={employee.store} returnFilter={filter} staffPage />
                </section>
                <section className="sale-detail-card">
                  <h3>Registrar vale</h3>
                  {employee.active ? <form className="admin-form" action={saveStaffAdvance}>
                    <input type="hidden" name="advanceId" value={randomUUID()} />
                    <input type="hidden" name="filter" value={filter} />
                    <input type="hidden" name="staffId" value={employee.id} />
                    <input type="hidden" name="focus" value={employee.id} />
                    <label>Valor (R$)<input name="amount" inputMode="decimal" maxLength={32} required /></label>
                    <label>Data de emissão<input name="date" type="date" defaultValue={today} max={today} required /></label>
                    <label className="span-two">Observação<input name="notes" maxLength={300} /></label>
                    <p className="form-note span-two">Registro interno. O lançamento financeiro e o desconto em folha são feitos separadamente.</p>
                    <div className="span-two"><Submit>Registrar vale</Submit></div>
                  </form> : <p>Ative o cadastro para registrar novos vales.</p>}
                </section>
                <section className="sale-detail-card">
                  <h3>Histórico de vales</h3>
                  {records.length ? <ul>{records.map((item) => <li key={item.id}>
                    {item.date.split("-").reverse().join("/")} · {money(item.amount)}{item.notes && " · " + item.notes}
                  </li>)}</ul> : <p>Nenhum vale registrado.</p>}
                </section>
              </div>
            </DetailsDialog></td>
          </tr>;
        })}</tbody>
      </table></div>
      {!staff.length && <p className="admin-empty">Nenhum funcionário nesta seleção.</p>}
    </section>
  </div>;
}
