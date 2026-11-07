import "server-only";
import { createHash } from "node:crypto";
import { Binary } from "mongodb";
import { RetailError } from "@/domain/retail";
import { getMongoDb } from "./mongodb";

export const invoiceOwners = ["purchase", "sale", "client"] as const;
export type InvoiceOwner = typeof invoiceOwners[number];
export const invoiceKinds = ["Compra", "Venda"] as const;
type InvoiceKind = typeof invoiceKinds[number];

export type InvoiceMeta = {
  _id: string;
  owner: InvoiceOwner;
  ownerId: string;
  kind: InvoiceKind;
  name: string;
  mime: "application/pdf" | "application/xml";
  createdAt: Date;
};

async function collection() {
  return (await getMongoDb()).collection<InvoiceMeta & { data: Binary }>("retail_invoices");
}

export async function listInvoices() {
  return (await collection()).find<InvoiceMeta>({}, { projection: { data: 0 } }).sort({ createdAt: -1 }).toArray();
}

export async function getInvoice(id: string) {
  return (await collection()).findOne({ _id: id });
}

export async function storeInvoice(owner: InvoiceOwner, ownerId: string, kind: InvoiceKind, file: File) {
  if (!file.size || file.size > 8 * 1024 * 1024) throw new RetailError("Selecione um PDF ou XML de até 8 MB.");
  const data = Buffer.from(await file.arrayBuffer());
  const name = (file.name.split(/[\\/]/).pop() ?? "").replace(/[\p{C}]/gu, "").trim();
  const pdf = /\.pdf$/i.test(name) && data.subarray(0, 5).toString() === "%PDF-";
  const xml = /\.xml$/i.test(name) && data.subarray(0, 1024).toString("utf8").trimStart().startsWith("<");
  if (name.length > 180 || (!pdf && !xml)) throw new RetailError("Anexe um arquivo válido em PDF ou XML com nome de até 180 caracteres.");
  const id = createHash("sha256").update(owner + ":" + ownerId + ":" + kind + ":").update(data).digest("hex");
  const document: Omit<InvoiceMeta, "_id"> & { data: Binary } = {
    owner, ownerId, kind, name, mime: pdf ? "application/pdf" : "application/xml",
    createdAt: new Date(), data: new Binary(data),
  };
  await (await collection()).updateOne({ _id: id }, { $setOnInsert: document }, { upsert: true });
}
