import { canAccess } from "@/domain/access";
import { getCurrentUser } from "@/lib/auth";
import { getContract } from "@/lib/contracts";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY" };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401, headers });
  if (!canAccess(user, "contratos")) return new Response(null, { status: 404, headers });
  const { id } = await params;
  const contract = /^[a-f0-9]{64}$/.test(id) ? await getContract(id) : null;
  if (!contract) return new Response(null, { status: 404, headers });

  const download = new URL(request.url).searchParams.has("download");
  const name = encodeURIComponent(contract.filename).replace(/['()*]/g, (char) => "%" + char.charCodeAt(0).toString(16));
  return new Response(Uint8Array.from(contract.data.value()), { headers: {
    ...headers,
    "Content-Type": "application/pdf",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="contrato.pdf"; filename*=UTF-8''${name}`,
  } });
}
