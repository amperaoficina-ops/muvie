import "server-only";
import { Binary } from "mongodb";
import { RetailError } from "@/domain/retail";
import { getMongoDb } from "./mongodb";

type Statement = { _id: string; name: string; data: Binary };

async function collection() {
  return (await getMongoDb()).collection<Statement>("cash_statements");
}

export async function saveCashStatement(id: string, file: File) {
  if (file.size > 8 * 1024 * 1024) throw new RetailError("O extrato deve ter até 8 MB.");

  const data = Buffer.from(await file.arrayBuffer());
  const name = (file.name.split(/[\\/]/).pop() ?? "").replace(/[\p{C}]/gu, "").trim();
  const format = name.split(".").pop()?.toLowerCase();
  const valid = (format === "pdf" && data.subarray(0, 5).toString("ascii") === "%PDF-") ||
    ((format === "jpg" || format === "jpeg") && data.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) ||
    (format === "png" && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (format === "webp" && data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP");
  if (!valid || name.length > 180) throw new RetailError("Selecione um extrato válido em PDF, JPG, PNG ou WebP, com nome de até 180 caracteres.");

  await (await collection()).insertOne({ _id: id, name, data: new Binary(data) });
  return name;
}

export async function getCashStatement(id: string) {
  return (await collection()).findOne({ _id: id });
}
