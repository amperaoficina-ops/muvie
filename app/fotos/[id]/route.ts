import { Binary } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getMongoDb } from "@/lib/mongodb";
import { readRetail } from "@/lib/retail-store";
import { canAccess } from "@/domain/access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{64}$/.test(id)) return new Response(null, { status: 404 });
  const products = (await readRetail()).products;
  const matches = products.filter((product) => product.imageUrl === "/fotos/" + id);
  const user = matches.length && !matches.some((item) => item.published) ? await getCurrentUser() : null;
  if (!matches.length || (!matches.some((item) => item.published) && (!user || !canAccess(user, "produtos")))) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const db = await getMongoDb();
  const photo = await db.collection<{ _id: string; data: Binary }>("product_photos").findOne({ _id: id });
  return photo ? new Response(Uint8Array.from(photo.data.value()), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  }) : new Response(null, { status: 404 });
}
