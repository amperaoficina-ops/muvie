import { scooterFields } from "@/domain/scooter";
import PDFDocument from "pdfkit";
import { canAccess } from "@/domain/access";
import { businessDate, money, storeName } from "@/domain/retail";
import { getCurrentUser } from "@/lib/auth";
import { readRetail } from "@/lib/retail-store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canAccess(user, "vendas")) return new Response(null, { status: 403 });
  const { id } = await params;
  const state = await readRetail();
  const sale = state.sales.find((item) => item.id === id);
  if (!sale || sale.canceledAt) return new Response(null, { status: 404 });

  const contact = state.contacts.find((item) => item.id === sale.contactId);
  const address = contact?.address;
  const doc = new PDFDocument({ size: "A4", margin: 56 });
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
    if (doc.y > doc.page.height - doc.page.margins.bottom - 90) doc.addPage();
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#5E4500").text(title).moveDown(0.35);
    for (const [label, value] of rows) {
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#151613").text(label);
      doc.font("Helvetica").text(value).moveDown(0.45);
    }
    doc.moveDown(0.5);
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
