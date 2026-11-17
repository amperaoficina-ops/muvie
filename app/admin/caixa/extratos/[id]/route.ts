import { canAccess } from "@/domain/access";
import { getCurrentUser } from "@/lib/auth";
import { getCashStatement } from "@/lib/cash-statements";
import { readRetail } from "@/lib/retail-store";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401, headers });
  if (!canAccess(user, "caixa")) return new Response(null, { status: 404, headers });
  const { id } = await params;
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) return new Response(null, { status: 404, headers });

  const state = await readRetail();
  if (!state.cashReconciliations?.some((row) => row.id === id && row.statementName)) {
    return new Response(null, { status: 404, headers });
  }
  const file = await getCashStatement(id);
  if (!file) return new Response(null, { status: 404, headers });
  const name = encodeURIComponent(file.name).replace(/['()*]/g, (char) => "%" + char.charCodeAt(0).toString(16));
  return new Response(Uint8Array.from(file.data.value()), { headers: {
    ...headers,
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename*=UTF-8''${name}`,
    "Content-Security-Policy": "default-src 'none'; sandbox",
  } });
}
