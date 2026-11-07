import { getCurrentUser } from "@/lib/auth";
import { getInvoice } from "@/lib/invoices";
import { canAccess, invoiceModule } from "@/domain/access";

const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401, headers: privateHeaders });
  const { id } = await params;
  const invoice = /^[a-f0-9]{64}$/.test(id) ? await getInvoice(id) : null;
  if (!invoice) return new Response(null, { status: 404, headers: privateHeaders });
  if (!canAccess(user, invoiceModule[invoice.owner])) return new Response(null, { status: 404, headers: privateHeaders });
  const extension = invoice.mime === "application/pdf" ? "pdf" : "xml";
  const encodedName = encodeURIComponent(invoice.name).replace(/['()*]/g, (char) => "%" + char.charCodeAt(0).toString(16));
  return new Response(Uint8Array.from(invoice.data.value()), {
    headers: {
      ...privateHeaders,
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="nota.${extension}"; filename*=UTF-8''${encodedName}`,
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
