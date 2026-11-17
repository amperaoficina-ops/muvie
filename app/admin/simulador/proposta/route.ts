import { join } from "node:path";
import PDFDocument from "pdfkit";
import { canAccess } from "@/domain/access";
import { proposalQuote } from "@/domain/proposal";
import { businessDate, money, rateMachineId, storeList } from "@/domain/retail";
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
  const machines = fields("machine");
  if (ids.length > 20 || methods.length > 10) return new Response("Proposta acima do limite de itens.", { status: 400 });

  const state = await readRetail();
  const store = storeList(state).find((unit) => unit.id === storeId);
  const validMachines = methods.every((method, index) => method !== "Cartão" ||
    state.cardRates.some((rate) => rate.id === rates[index] && rateMachineId(rate) === machines[index]));
  const quote = store && validMachines && proposalQuote(state.products, state.cardRates, store.id,
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
  const left = 46;
  const width = doc.page.width - left * 2;
  const right = left + width;
  const ink = "#17191F";
  const muted = "#525861";
  const yellow = "#FFCC00";
  const date = businessDate().split("-").reverse().join("/");
  const logo = join(process.cwd(), "public", "brand", "logo-muvi-e.png");
  const text = (value: string, x: number, y: number, span: number, size = 10, bold = false, color = ink, align: "left" | "right" = "left") => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(color).text(value, x, y, { width: span, align });
  };
  let y = 44;
  const header = (first: boolean) => {
    const height = first ? 112 : 54;
    doc.roundedRect(left, y, width, height, 9).fill("#090909");
    doc.rect(left + 12, y + height - 4, width - 24, 2).fill(yellow);
    if (first) doc.image(logo, left + 10, y + 4, { fit: [104, 104] });
    text(first ? "Proposta comercial" : "MUVI-E · Proposta comercial", left + (first ? 126 : 16), y + (first ? 29 : 12), width - (first ? 142 : 32), first ? 25 : 14, true, "#FFFFFF");
    text(store.name + "  •  " + date, left + (first ? 126 : 16), y + (first ? 65 : 32), width - (first ? 142 : 32), 10, false, yellow);
    y += height + 18;
  };
  const ensureSpace = (height: number) => {
    if (y + height <= doc.page.height - 46) return false;
    doc.addPage();
    y = 44;
    header(false);
    return true;
  };
  const divider = () => doc.moveTo(left, y).lineTo(right, y).strokeColor("#DFE2E6").stroke();
  const section = (title: string) => {
    text(title, left, y, width, 13, true);
    y += 21;
  };

  header(true);
  if (customer) {
    doc.roundedRect(left, y, width, 52, 7).fill("#F2F4F6");
    text("PREPARADA PARA", left + 13, y + 9, width - 26, 8, true, muted);
    text(customer, left + 13, y + 23, width - 26, 11, true);
    y += 68;
  }

  const tableHeader = () => {
    section("Produtos");
    doc.roundedRect(left, y, width, 26, 5).fill("#F2F4F6");
    text("PRODUTO", left + 10, y + 8, width - 250, 8, true, muted);
    text("QTD.", right - 254, y + 8, 43, 8, true, muted, "right");
    text("VALOR UNITÁRIO", right - 205, y + 8, 92, 8, true, muted, "right");
    text("SUBTOTAL", right - 106, y + 8, 96, 8, true, muted, "right");
    y += 26;
  };
  tableHeader();
  for (const line of quote.lines) {
    const nameWidth = width - 270;
    doc.font("Helvetica-Bold").fontSize(10);
    const height = Math.max(31, doc.heightOfString(line.name, { width: nameWidth }) + 17);
    if (ensureSpace(height)) tableHeader();
    text(line.name, left + 10, y + 9, nameWidth, 10, true);
    text(String(line.quantity), right - 254, y + 9, 43, 10, false, ink, "right");
    text(money(line.unitPrice), right - 205, y + 9, 92, 10, false, ink, "right");
    text(money(line.total), right - 106, y + 9, 96, 10, true, ink, "right");
    y += height;
    divider();
  }
  y += 16;
  ensureSpace(107);
  if (quote.discount) {
    text("Subtotal  " + money(quote.subtotal) + "     Desconto  − " + money(quote.discount), left, y, width, 10, false, muted, "right");
    y += 18;
  }
  doc.roundedRect(left, y, width, 53, 8).fill("#FFF2B5");
  text("TOTAL DA PROPOSTA", left + 14, y + 21, 175, 10, true);
  text(money(quote.total), left + 184, y + 14, width - 198, 20, true, ink, "right");
  y += 72;

  ensureSpace(61);
  section("Condições de pagamento");
  for (const payment of quote.payments) {
    const height = payment.installments ? 44 : 28;
    if (ensureSpace(height)) section("Condições de pagamento");
    text(payment.method, left + 9, y + 6, width - 125, 10, true);
    text(money(payment.amount), right - 110, y + 6, 101, 10, true, ink, "right");
    if (payment.installments) text(payment.installments, left + 9, y + 21, width - 120, 9, false, muted);
    y += height;
    divider();
  }
  y += 20;
  ensureSpace(112);
  text("Proposta sujeita à confirmação de disponibilidade e condições no momento da compra.", left, y, width, 9, false, muted);
  y += 68;
  doc.moveTo(right - 206, y).lineTo(right, y).strokeColor("#767B83").stroke();
  text("Responsável comercial · MUVI-E", right - 206, y + 8, 206, 9, true, ink, "right");
  text("Unidade " + store.name, right - 206, y + 23, 206, 9, false, muted, "right");
  doc.end();
  return new Response(Uint8Array.from(await pdf), { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": 'attachment; filename="proposta-muvi-e.pdf"',
    "Cache-Control": "private, no-store",
  } });
}
