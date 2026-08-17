import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "session_id";

/**
 * Safe in a Server Component — read-only, never tries to set a cookie.
 * Returns null for a brand-new visitor with no session yet.
 */
export async function getSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/**
 * Only callable from a Server Action or Route Handler — cookies() can't
 * set cookies during plain Server Component rendering.
 */
export async function getOrCreateSessionId(): Promise<string> {
  const cookieStore = await cookies();

    // (Marcus):
  // 1. cookieStore.get(SESSION_COOKIE_NAME) — does it exist already?
  //    (returns { name, value } or undefined)
  // 2. If it exists, return its .value.
  // 3. If not: generate a new id with crypto.randomUUID(), store it with
  //    cookieStore.set(SESSION_COOKIE_NAME, newId, { httpOnly: true }),
  //    then return newId.

  const cookieSession = cookieStore.get(SESSION_COOKIE_NAME);
  if( cookieSession ) {
    return cookieSession.value
  } else {
    const newId = crypto.randomUUID();
    cookieStore.set(SESSION_COOKIE_NAME, newId, { httpOnly: true })
    return newId;
  }
}
