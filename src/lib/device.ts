import { cookies } from "next/headers";
import { randomBytes } from "crypto";

const COOKIE_NAME = "dg_device";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Read or create a persistent anonymous device id. */
export async function getOrCreateDeviceId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  if (existing) return existing;

  const id = randomBytes(16).toString("hex");
  store.set(COOKIE_NAME, id, {
    maxAge: ONE_YEAR,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return id;
}

export async function getDeviceId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}
