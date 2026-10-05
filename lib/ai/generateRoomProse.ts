import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { z } from "zod";
import type { Room } from "../engine/types";

// 1. Define the response shape as a Zod schema:
//      prose: string
//      mood: "tense" | "calm" | "eerie"
//      referencedItems: string[]
//    export it too — you'll want it for validating whatever comes back.
//
// const roomProseSchema = z.object({ ... });
// export type RoomProse = z.infer<typeof roomProseSchema>;
const roomProseSchema = z.object({
    prose: z.string(),
    mood: z.enum(['tense', 'calm', 'eerie']),
    referencedItems: z.array(z.string())
})
export type RoomProse = z.infer<typeof roomProseSchema>;
// 2. Write the prompt template — a function that takes a Room and returns
//    the string sent to the model. Tell it explicitly to return ONLY JSON
//    matching the shape above, nothing else. Keep it short; every extra
//    token in the prompt is tokens you pay for on every single call.
//
// function buildPrompt(room: Room): string { ... }
function buildPrompt(room: Room) : string {
    const { description, title, items, exits } = room;
    let str = `Using the following facts about this room, generate a more detailed description. Title: ${title}. Description: ${description}. Items: ${items.join(', ')}. Exits: ${Object.keys(exits).join(', ')}`;
    str += ` Return ONLY JSON in exactly this shape, nothing else:
            {"prose": "...", "mood": "tense" | "calm" | "eerie", "referencedItems": ["itemId", ...]}
            `;
    return str;
}
// 3. The call itself. Model choice: check Groq's console for their
//    current smallest/cheapest model — these get deprecated and replaced
//    often enough that hardcoding one here would go stale. Something like:
//
//      const result = await generateText({
//        model: groq("<model id from the Groq console>"),
//        prompt: buildPrompt(room),
//        temperature: 0.8,
//        maxOutputTokens: 200,
//      });
//

//    result.text is a plain string — the model's raw response. Nothing
//    guarantees it's valid JSON, or JSON matching your schema. That's the
//    next problem.
//
// export async function generateRoomProse(room: Room): Promise<RoomProse> {
//   TODO
// }

export async function generateRoomProse(room: Room): Promise<any> {
    const result = await generateText({
        model: google("gemini-flash-lite-latest"),
        prompt: buildPrompt(room),
        temperature: 0.8,
        maxOutputTokens: 200,
    })
    console.log( 'result:', result );
}

// 4. Once the naive version is calling the model and you've actually seen
//    it fail (malformed JSON, markdown fences, a schema mismatch — try it
//    a few times, Groq will misbehave eventually), come back and add:
//    parse -> validate -> on failure, retry once -> on second failure,
//    fall back to a plain result built from room.description instead of
//    throwing. We'll talk through why "retry once then fall back" is the
//    right shape once you've seen the failure it's protecting against.
