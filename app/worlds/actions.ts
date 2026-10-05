"use server";

import { revalidatePath } from "next/cache";
import { db } from "../../lib/db/client";
import { worlds } from "../../lib/db/schema";

export type CreateWorldState = { error?: string; success?: boolean };

export async function createWorld(
  _prev: CreateWorldState,
  formData: FormData,
): Promise<CreateWorldState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };
  if (name.length > 100) return { error: "Name must be 100 characters or fewer." };

  try {
    await db.insert(worlds).values({ name });
  } catch {
    return { error: "Couldn't save the world. Try again." };
  }

  revalidatePath("/worlds");
  return { success: true };
}
