import "server-only";
import { createHash } from "node:crypto";
import { Binary } from "mongodb";
import sharp from "sharp";
import { RetailError } from "@/domain/retail";
import { getMongoDb } from "./mongodb";

export async function storeProductPhoto(file: File) {
  if (file.size > 5 * 1024 * 1024) throw new RetailError("A foto deve ter até 5 MB.");
  let bytes: Buffer;
  try {
    const photo = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 25_000_000 });
    const { format } = await photo.metadata();
    if (!format || !["jpeg", "png", "webp"].includes(format)) throw new Error("Formato");
    bytes = await photo.rotate().resize(1400, 1400, { fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
  } catch {
    throw new RetailError("Selecione uma imagem válida em JPG, PNG ou WebP.");
  }
  const id = createHash("sha256").update(bytes).digest("hex");
  const db = await getMongoDb();
  await db.collection<{ _id: string; data: Binary }>("product_photos").updateOne(
    { _id: id }, { $setOnInsert: { data: new Binary(bytes) } }, { upsert: true },
  );
  return "/fotos/" + id;
}
