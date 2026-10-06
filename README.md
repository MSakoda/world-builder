# Emberhold

A small text adventure on Next.js and Postgres. The game rules are deterministic code; the AI only writes flavor prose for rooms and can never change game state.

## Architecture: where each kind of work lives

The rule of thumb is to match the tool to who owns the state. Data that lives on the server is read on the server. Data the client changes many times a second is managed by a client cache.

| Need | Tool | Where |
| --- | --- | --- |
| Read data that lives in Postgres | Server Components | `app/page.tsx` loads the world and the player's run; `app/worlds/page.tsx` queries the database directly |
| Form-shaped writes | Server Actions | `createWorld` (`useActionState`, `useFormStatus`, `revalidatePath`) |
| A fast interactive loop with optimistic updates | TanStack Query | `GameView` plus the `/api/action` route handler |
| A response that arrives over time | Route Handler returning a `ReadableStream` | `/api/prose/stream`, read by the `useRoomProse` hook |

**Why Server Components and Server Actions for reads and forms.** The world and the saved worlds are rows in Postgres. Reading them in a Server Component means no API layer to write, no client-side loading spinner, no waterfall, and the database credentials never reach the browser. The first paint already has the data. Creating a world is a plain form submission, which is what Server Actions are for. It works without JavaScript, validates on the server, and `revalidatePath` refreshes the list.

**Why the game loop still uses TanStack Query.** Moving between rooms has to feel instant, so the client predicts the result and rolls back if the server disagrees. That needs a client cache to hold the optimistic state. It works because the engine's `applyAction` is a pure function shared by the browser and the server: the client predicts with it, and the server runs the same code and is the authority.

**Why streaming is a Route Handler, not a Server Action.** A Server Action returns one value when it finishes. Streaming prose to the player as it is generated, with Stop and retry, needs a `Response` body the client can read incrementally and abort. The stream ends with a marker so a cleanly cut connection is not mistaken for a finished one. The 10-per-session cap is enforced in that route against the database, not in the UI.

**How this differs from the Fleet Dashboard.** That project uses TanStack Query because it is the opposite shape: data the user watches change over time, shared by many components. It needs refetching, background refresh, cache invalidation and per-widget loading and error states, and a Server Component render happens once and has none of those. Here, the server owns the data and the page is mostly a read plus occasional form posts. There, the client owns a continuously refreshed view. Neither choice is better in general. Each one fits where the state lives.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
