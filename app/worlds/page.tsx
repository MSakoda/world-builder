import { connection } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "../../lib/db/client";
import { worlds } from "../../lib/db/schema";
import CreateWorldForm from "./CreateWorldForm";

export default async function WorldsPage() {
  // Query the database per request instead of at build time.
  await connection();
  const saved = await db.select().from(worlds).orderBy(desc(worlds.created_at));

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
    </main>
  );
}
