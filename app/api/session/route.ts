import { getOrCreateSessionId } from "../../../lib/session";

export async function GET() {
  const sessionId = await getOrCreateSessionId();
  return Response.json({ sessionId });
}
