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
  const product = state.products.find((item) => item.id === sale.productId);
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
  const rows = [
    ["Referência", sale.id],
    ["Data da venda", businessDate(new Date(sale.createdAt)).split("-").reverse().join("/")],
    ["Unidade", storeName(sale.store, state)],
    ["Comprador", sale.customer],
    ["CPF", contact?.cpf || "A confirmar"],
    ["Contato", [contact?.email, contact?.phone].filter(Boolean).join(" · ") || "A confirmar"],
    ["Endereço", address ? [address.street, address.number, address.complement, address.neighborhood, address.city, address.state, address.postalCode].filter(Boolean).join(", ") || "A confirmar" : "A confirmar"],
    ["Produto", `${sale.quantity} × ${sale.productName} (${sale.sku})`],
    ["Categoria cadastrada", product?.category ?? "A confirmar"],
    ["Valor unitário", money(sale.unitPrice)],
    ["Desconto", money(sale.discount)],
    ["Total", money(sale.total)],
    ["Forma de pagamento registrada", sale.method],
  ];
  for (const [label, value] of rows) {
    doc.font("Helvetica-Bold").text(label);
    doc.font("Helvetica").text(value).moveDown(0.6);
  }
  const specs = product?.specs;
  const characteristics = scooterFields.flatMap(({ key, label }) => specs?.[key] ? [label + ": " + specs[key]] : []);
  if (characteristics.length) {
    doc.moveDown().font("Helvetica-Bold").text("Características no cadastro atual");
    doc.font("Helvetica").text(characteristics.join("\n"));
  }
  if (sale.fiscalNotes) {
    doc.moveDown().font("Helvetica-Bold").text("Informações complementares");
    doc.font("Helvetica").text(sale.fiscalNotes);
  }
  doc.end();

  return new Response(Uint8Array.from(await pdf), { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": 'attachment; filename="ficha-fiscal-muvi-e.pdf"',
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
