import PDFDocument from "pdfkit";
import { canAccess } from "@/domain/access";
import { proposalQuote } from "@/domain/proposal";
import { businessDate, money, storeList } from "@/domain/retail";
import { getCurrentUser } from "@/lib/auth";
import { readRetail } from "@/lib/retail-store";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccess(user, "simulador")) return new Response("Acesso restrito.", { status: 403 });

  const form = await request.formData();
  const storeId = String(form.get("store") ?? "");
  const customer = String(form.get("customer") ?? "").trim().slice(0, 100);
  const fields = (name: string) => form.getAll(name).map(String);
  const ids = fields("product");
  const quantities = fields("quantity");
  const methods = fields("method");
  const amounts = fields("amount");
  const rates = fields("rate");
  if (ids.length > 20 || methods.length > 10) return new Response("Proposta acima do limite de itens.", { status: 400 });

  const state = await readRetail();
  const store = storeList(state).find((unit) => unit.id === storeId);
  const quote = store && proposalQuote(state.products, state.cardRates, store.id,
    ids.map((productId, index) => ({ productId, quantity: quantities[index] ?? "" })),
    methods.map((method, index) => ({ method, amount: amounts[index] ?? "", rateId: rates[index] ?? "" })),
    String(form.get("discount") ?? ""));
  if (!store || !quote) return new Response("Confira os itens, estoque e condições de pagamento. Atualize o simulador e tente novamente.", { status: 400 });

  const doc = new PDFDocument({ size: "A4", margin: 46 });
  const chunks: Buffer[] = [];
  const pdf = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.once("error", reject);
    doc.once("end", () => resolve(Buffer.concat(chunks)));
  });
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#725600").text("MUVI-E");
  doc.moveDown(.4).fontSize(27).fillColor("#151613").text("Proposta comercial");
  doc.font("Helvetica").fontSize(11).moveDown(.5).text(`${store.name} · ${businessDate().split("-").reverse().join("/")}`);
  if (customer) doc.text("Para " + customer);
  doc.moveDown(1.3).font("Helvetica-Bold").fontSize(14).text("Produtos");
  for (const line of quote.lines) {
    doc.moveDown(.45).fontSize(11).font("Helvetica-Bold").text(line.name);
    doc.font("Helvetica").text(`${line.quantity} un. × ${money(line.unitPrice)}  |  ${money(line.total)}`);
  }
  if (quote.discount) doc.moveDown(.75).text("Desconto: " + money(quote.discount));
  doc.moveDown().font("Helvetica-Bold").fontSize(18).text("Total  " + money(quote.total));
  doc.moveDown().fontSize(14).text("Condições de pagamento");
  for (const payment of quote.payments) {
    doc.moveDown(.4).font("Helvetica").fontSize(11).text(`${payment.method} · ${money(payment.amount)}`);
    if (payment.installments) doc.text(payment.installments);
  }
  doc.moveDown(1.5).fontSize(9).fillColor("#52544b").text("Proposta sujeita à confirmação de disponibilidade e condições no momento da compra.");
  doc.end();
  return new Response(Uint8Array.from(await pdf), { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": 'attachment; filename="proposta-muvi-e.pdf"',
    "Cache-Control": "private, no-store",
  } });
}
