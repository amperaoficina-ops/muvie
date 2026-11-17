import "server-only";
import { Binary } from "mongodb";
import { createHash } from "node:crypto";
import { RetailError } from "@/domain/retail";
import { getMongoDb } from "./mongodb";

type ContractInfo = { _id: string; title: string; filename: string; createdAt: Date };

async function collection() {
  return (await getMongoDb()).collection<ContractInfo & { data: Binary }>("contract_templates");
}

export async function listContracts() {
  return (await collection()).find<ContractInfo>({}, { projection: { data: 0 } }).sort({ createdAt: -1 }).toArray();
}

export async function getContract(id: string) {
  return (await collection()).findOne({ _id: id });
}

export async function storeContract(file: File, title?: string) {
  if (!file.size || file.size > 8 * 1024 * 1024) throw new RetailError("Selecione um PDF de até 8 MB.");
  const data = Buffer.from(await file.arrayBuffer());
  const filename = (file.name.split(/[\\/]/).pop() ?? "").replace(/[\p{C}]/gu, "").trim();
  if (filename.length > 180 || !/\.pdf$/i.test(filename) || data.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new RetailError("Anexe um PDF válido com nome de até 180 caracteres.");
  }
  const name = title || filename.slice(0, -4).trim() || "Contrato";
  const id = createHash("sha256").update(name).update("\0").update(data).digest("hex");
  await (await collection()).updateOne({ _id: id }, {
    $setOnInsert: { title: name, filename, data: new Binary(data), createdAt: new Date() },
  }, { upsert: true });
}
