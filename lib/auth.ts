import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMongoDb } from "./mongodb";
import { verifyPassword } from "./security";
import type { AccountAccess } from "@/domain/access";

export type User = AccountAccess & { email: string; name: string; passwordHash: string; disabled?: boolean };
type Session = { hash: string; userEmail: string; expiresAt: Date };
const sessionCookie = process.env.MUVIE_DEMO === "1" ? "muvie_demo_session" : "muvie_session";
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function login(email: string, password: string) {
  const db = await getMongoDb();
  const user = await db.collection<User>("users").findOne({ email });
  if (!user || user.disabled || !verifyPassword(password, user.passwordHash)) return false;
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  await db.collection<Session>("sessions").insertOne({ hash: hashToken(token), userEmail: user.email, expiresAt });
  (await cookies()).set(sessionCookie, token, { httpOnly: true, sameSite: "strict", path: "/", expires: expiresAt });
  return true;
}

export async function getCurrentUser() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const db = await getMongoDb();
  const session = await db.collection<Session>("sessions").findOne({ hash: hashToken(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  return db.collection<User>("users").findOne({ email: session.userEmail, disabled: { $ne: true } }, { projection: { passwordHash: 0 } });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  if (token) await (await getMongoDb()).collection<Session>("sessions").deleteOne({ hash: hashToken(token) });
  jar.delete(sessionCookie);
}
