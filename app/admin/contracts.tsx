import { listContracts } from "@/lib/contracts";
import { importContract } from "./actions";
import { AttachmentPicker } from "./attachment-picker";
import { CreateDialog } from "./sale-dialog";
import { RecordSearch } from "./record-search";
import { matchesSearch } from "./search-text";
import { Submit } from "./submit";

const dates = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });

export async function Contracts({ canImport, query }: { canImport: boolean; query: string }) {
  const contracts = await listContracts().catch(() => null);

  const results = contracts?.filter((contract) => matchesSearch(query, contract.title, contract.filename)) ?? [];

  return <>
    {canImport && <div className="admin-filter-bar"><a className="button yellow" href="#importar-contrato">＋ Importar PDF</a></div>}
    <section className="panel">
      <div className="panel-title"><h2>Documentos disponíveis</h2></div>
      {contracts !== null && <div className="panel-title"><RecordSearch tab="contratos" store="" query={query} /></div>}
      {contracts === null ? <p className="feedback error" role="alert">Não foi possível carregar os contratos. Tente novamente.</p>
        : results.length ? <div className="table-wrap"><table>
          <thead><tr><th scope="col">Documento</th><th scope="col">Adicionado em</th><th scope="col">Ações</th></tr></thead>
          <tbody>{results.map((contract) => {
            const url = "/admin/contratos/" + contract._id;
            return <tr key={contract._id}>
              <td><strong>{contract.title}</strong>{contract.title !== contract.filename && <small>{contract.filename}</small>}</td>
              <td>{dates.format(contract.createdAt)}</td>
              <td><div className="admin-filter-bar">
                <a className="button" href={url + "?download=1"} aria-label={`Baixar ${contract.title}`}>Baixar PDF</a>
                <a className="button" href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${contract.title} para imprimir em nova aba`}>Abrir para imprimir ↗</a>
              </div></td>
            </tr>;
          })}</tbody>
        </table></div>
        : <p className="admin-empty">{query ? "Nenhum documento encontrado para essa busca." : "Nenhum contrato ou termo de venda disponível."}</p>}
    </section>
    {canImport && <CreateDialog id="importar-contrato" title="Importar PDF" reopen={false}>
      <form action={importContract} className="admin-form">
        <label className="span-two">Nome do documento <input name="title" maxLength={120} placeholder="Ex. Termo de venda" /></label>
        <div className="span-two"><AttachmentPicker name="contract" label="Selecionar PDF" accept=".pdf,application/pdf"
          hint="PDF de até 8 MB. Se deixar o nome em branco, será usado o nome do arquivo." required /></div>
        <div className="span-two"><Submit>Importar PDF</Submit></div>
      </form>
    </CreateDialog>}
  </>;
}
