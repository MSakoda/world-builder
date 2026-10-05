"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createWorld, type CreateWorldState } from "./actions";

// useFormStatus must be called from a component rendered inside the <form>.
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create world"}
    </button>
  );
}

export default function CreateWorldForm() {
  const [state, action] = useActionState<CreateWorldState, FormData>(createWorld, {});

  return (
    <form action={action}>
      <input name="name" placeholder="World name" required maxLength={100} />
      <SubmitButton />
      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p>World created.</p>}
    </form>
  );
}
