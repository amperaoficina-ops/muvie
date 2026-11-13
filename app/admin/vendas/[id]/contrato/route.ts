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

  const doc = new PDFDocument({ size: "A4", margin: 56 });
  const chunks: Buffer[] = [];
  const pdf = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.once("error", reject);
    doc.once("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.font("Helvetica-Bold").fontSize(14).fillColor("#5E4500").text("MUVI-E");
  doc.moveDown().fontSize(25).fillColor("#151613").text("Minuta de contrato de venda");
  doc.font("Helvetica").fontSize(11).moveDown()
    .text("Versão preliminar. Complete a identificação das partes e revise as condições antes da assinatura.");
  doc.moveDown(1.5);
  const rows = [
    ["Referência", sale.id],
    ["Data da venda", businessDate(new Date(sale.createdAt)).split("-").reverse().join("/")],
    ["Unidade", storeName(sale.store, state)],
    ["Comprador", sale.customer],
    ["Produto", `${sale.quantity} × ${sale.productName} (${sale.sku})`],
    ["Total", money(sale.total)],
    ["Forma de pagamento registrada", sale.method],
  ];
  for (const [label, value] of rows) {
    doc.font("Helvetica-Bold").text(label);
    doc.font("Helvetica").text(value).moveDown(0.6);
  }
  doc.moveDown().text("Identificação do vendedor / CNPJ: __________________________________");
  doc.moveDown().text("Condições de entrega, garantia e demais termos: ______________________");
  doc.moveDown(2).text("Comprador _____________________      Vendedor _____________________");
  doc.end();

  return new Response(Uint8Array.from(await pdf), { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": 'attachment; filename="minuta-venda-muvi-e.pdf"',
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
