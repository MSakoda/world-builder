import { connection } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "../../lib/db/client";
import { generations, rooms, worlds } from "../../lib/db/schema";
import CreateWorldForm from "./CreateWorldForm";

export default async function WorldsPage() {
  // Query the database per request instead of at build time.
  await connection();
  const saved = await db.select().from(worlds).orderBy(desc(worlds.created_at));
  const recent = await db
    .select({
      id: generations.id,
      room: rooms.title,
      mood: generations.mood,
      prose: generations.prose,
      created_at: generations.created_at,
    })
    .from(generations)
    .innerJoin(rooms, eq(generations.room_id, rooms.id))
    .orderBy(desc(generations.created_at))
    .limit(10);

  return (
    <main>
      <h1>Saved worlds</h1>
      <CreateWorldForm />
      {saved.length === 0 ? (
        <p>No worlds saved yet.</p>
      ) : (
        <ul>
          {saved.map((w) => (
            <li key={w.id}>
              {w.name} <small>{w.created_at.toLocaleString()}</small>
            </li>
          ))}
        </ul>
      )}
      <h2>Recent descriptions</h2>
      {recent.length === 0 ? (
        <p>No descriptions generated yet.</p>
      ) : (
        <ul>
          {recent.map((g) => (
            <li key={g.id}>
              <strong>{g.room}</strong> ({g.mood}): {g.prose}{" "}
              <small>{g.created_at.toLocaleString()}</small>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
