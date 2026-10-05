import { loadWorld } from "../../../lib/db/loadWorld";
import { getRoomProse } from "../../../lib/ai/getRoomProse";

// Separate from /api/action so a slow model call never blocks a game action.
export async function GET(request: Request) {
  const roomId = new URL(request.url).searchParams.get("room") ?? "";
  const world = await loadWorld();
  const room = world.rooms[roomId];
  if (!room) return Response.json({ error: "Unknown room" }, { status: 404 });
  return Response.json(await getRoomProse(room));
}
