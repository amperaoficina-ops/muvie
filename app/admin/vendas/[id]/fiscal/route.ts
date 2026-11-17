import { scooterFields } from "@/domain/scooter";
import PDFDocument from "pdfkit";
import { canAccess } from "@/domain/access";
import { businessDate, money, storeName } from "@/domain/retail";
import { getCurrentUser } from "@/lib/auth";
import { readRetail } from "@/lib/retail-store";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canAccess(user, "vendas")) return new Response(null, { status: 403 });
  const { id } = await params;
  const state = await readRetail();
  const sale = state.sales.find((item) => item.id === id);
  if (!sale || sale.canceledAt) return new Response(null, { status: 404 });

  const contact = state.contacts.find((item) => item.id === sale.contactId);
  const address = contact?.address;
  const items = sale.lines ?? [sale];
  if (new URL(request.url).searchParams.get("formato") === "xml") {
    const escape = (value: string | number) => String(value).replace(/[<>&"']/g,
      (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]!);
    const field = (name: string, value?: string | number) => value == null || value === "" ? "" :
      `<${name}>${escape(value)}</${name}>`;
    const decimal = (amount: number) => (amount / 100).toFixed(2);
    const destination = field("CPF", contact?.cpf?.replace(/\D/g, "")) + field("xNome", sale.customer) +
      (address ? `<enderDest>${field("xLgr", address.street)}${field("nro", address.number)}
        ${field("xCpl", address.complement)}${field("xBairro", address.neighborhood)}
        ${field("xMun", address.city)}${field("UF", address.state)}${field("CEP", address.postalCode?.replace(/\D/g, ""))}
      </enderDest>` : "") + field("email", contact?.email);
    const details = items.map((item, index) =>
      `<det nItem="${index + 1}"><prod>${field("cProd", item.sku)}${field("xProd", item.productName)}
        ${field("qCom", item.quantity)}${field("vUnCom", decimal(item.unitPrice))}
        ${field("vProd", decimal(item.quantity * item.unitPrice))}</prod></det>`).join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Prévia sem valor fiscal. Complete os dados fiscais no emissor. Sem assinatura ou protocolo. -->
<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe versao="4.00">
  <ide><mod>55</mod></ide>
  <dest>${destination}</dest>
  ${details}
  <total><ICMSTot>${field("vProd", decimal(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)))}
    ${field("vDesc", decimal(sale.discount))}${field("vNF", decimal(sale.total))}</ICMSTot></total>
  ${sale.fiscalNotes ? `<infAdic>${field("infCpl", sale.fiscalNotes)}</infAdic>` : ""}
</infNFe></NFe>`;
    return new Response(xml, { headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": 'attachment; filename="previa-nfe-muvi-e.xml"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  }
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const chunks: Buffer[] = [];
  const pdf = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.once("error", reject);
    doc.once("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.font("Helvetica-Bold").fontSize(14).fillColor("#5E4500").text("MUVI-E");
  doc.moveDown().fontSize(25).fillColor("#151613").text("Ficha fiscal da venda");
  doc.font("Helvetica").fontSize(11).moveDown()
    .text("PRÉVIA PARA EMISSÃO | SEM VALOR FISCAL. Dados para conferência e preenchimento no emissor fiscal.");
  doc.moveDown(1.5);
  const section = (title: string, rows: Array<[string, string]>) => {
    const x = doc.page.margins.left;
    const width = doc.page.width - x - doc.page.margins.right;
    if (doc.y > doc.page.height - doc.page.margins.bottom - 90) doc.addPage();
    doc.rect(x, doc.y, width, 19).fillAndStroke("#eeeeee", "#555555");
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#151613").text(title.toUpperCase(), x + 6, doc.y + 5, { width: width - 12 });
    doc.y += 4;
    for (const [label, value] of rows) {
      doc.font("Helvetica").fontSize(10);
      const height = doc.heightOfString(value, { width: width - 12 }) + 25;
      if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
      const y = doc.y;
      doc.rect(x, y, width, height).stroke("#555555");
      doc.font("Helvetica-Bold").fontSize(8).text(label.toUpperCase(), x + 6, y + 4, { width: width - 12 });
      doc.font("Helvetica").fontSize(10).text(value, x + 6, y + 15, { width: width - 12 });
      doc.y = y + height;
    }
    doc.x = x;
    doc.moveDown(0.75);
  };

  section("01  Operação e emitente", [
    ["Referência interna", sale.id],
    ["Data da venda", businessDate(new Date(sale.createdAt)).split("-").reverse().join("/")],
    ["Unidade da venda", storeName(sale.store, state)],
    ["Conferir no emissor", "Razão social, CNPJ, inscrição estadual, endereço fiscal e natureza da operação."],
  ]);
  section("02  Destinatário", [
    ["Comprador", sale.customer],
    ["CPF", contact?.cpf || "A confirmar"],
    ["Contato", [contact?.email, contact?.phone].filter(Boolean).join(" · ") || "A confirmar"],
    ["Endereço", address ? [address.street, address.number, address.complement, address.neighborhood, address.city, address.state, address.postalCode].filter(Boolean).join(", ") || "A confirmar" : "A confirmar"],
  ]);
  for (const [index, line] of (sale.lines ?? [sale]).entries()) {
    const product = state.products.find((item) => item.id === line.productId);
    const specs = product?.specs;
    const characteristics = scooterFields.flatMap(({ key, label }) => specs?.[key] ? [label + ": " + specs[key]] : []);
    const isGift = "gift" in line && line.gift;
    section("Item " + (index + 1) + " · " + line.productName + (isGift ? " · Brinde" : ""), [
      ["Código interno", line.sku],
      ["Quantidade e valor unitário", String(line.quantity) + " un. × " + money(line.unitPrice)],
      ["Subtotal comercial antes de descontos", money(line.unitPrice * line.quantity)],
      ["Classificação a conferir", "NCM, CFOP, unidade comercial, GTIN e enquadramento tributário do item."],
      ...(characteristics.length ? [["Características no cadastro atual", characteristics.join("\n")] as [string, string]] : []),
    ]);
  }
  section("Totais e pagamentos registrados", [
    ["Desconto comercial", money(sale.discount)],
    ["Total da venda", money(sale.total)],
    ["Pagamento", sale.payments?.length ? sale.payments.map((item) => item.method + " · " + money(item.amount)).join("\n") : sale.method],
  ]);
  section("Informações complementares", [["Observações para emissão", sale.fiscalNotes || "Nenhuma observação registrada."]]);
  doc.end();

  return new Response(Uint8Array.from(await pdf), { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": 'attachment; filename="ficha-fiscal-muvi-e.pdf"',
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
