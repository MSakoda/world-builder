import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { z } from "zod";
import type { Room } from "../engine/types";

const roomProseSchema = z.object({
  prose: z.string().min(1),
  mood: z.enum(["tense", "calm", "eerie"]),
  referencedItems: z.array(z.string()),
});
export type RoomProse = z.infer<typeof roomProseSchema>;

export const PROSE_MODEL = "gemini-flash-lite-latest";

function buildPrompt(room: Room): string {
  const { description, title, items, exits } = room;
  return (
    `Using the following facts about this room, write a more detailed description in 2-3 sentences. ` +
    `Title: ${title}. Description: ${description}. Items: ${items.join(", ") || "none"}. ` +
    `Exits: ${Object.keys(exits).join(", ")}. ` +
    `Return ONLY JSON in exactly this shape, nothing else: ` +
    `{"prose": "...", "mood": "tense" | "calm" | "eerie", "referencedItems": ["itemId", ...]}`
  );
}

// Models sometimes wrap JSON in ```json fences despite being told not to.
function parseProse(text: string): RoomProse | null {
  const cleaned = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  try {
    const parsed = roomProseSchema.safeParse(JSON.parse(cleaned));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Calls the model. Returns null if both attempts fail, so callers can fall back. */
export async function generateRoomProse(room: Room): Promise<RoomProse | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text } = await generateText({
        model: google(PROSE_MODEL),
        prompt: buildPrompt(room),
        temperature: 0.8,
        maxOutputTokens: 400,
        abortSignal: AbortSignal.timeout(15_000),
      });
      const prose = parseProse(text);
      if (prose) return prose;
    } catch (err) {
      console.error("generateRoomProse attempt failed:", err);
    }
  }
  return null;
}

/** Plain result built from the hand-authored description. */
export function fallbackProse(room: Room): RoomProse {
  return { prose: room.description, mood: "calm", referencedItems: [] };
}
