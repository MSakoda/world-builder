import { expect, test, type Route } from "@playwright/test";
import { STREAM_END } from "../lib/ai/streamProtocol";

const MOCK_PROSE = "Mocked prose: lantern light trembles across the dust-sheeted hall.";

test("start, stop, and retry a generation (provider route mocked)", async ({ page }) => {
  // No real model call is ever made: /api/prose/stream is answered here.
  const held: Route[] = [];
  let answer = false;
  let calls = 0;
  await page.route("**/api/prose/stream*", async (route) => {
    calls++;
    if (!answer) {
      held.push(route); // leave the generation "in progress"
      return;
    }
    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Generations-Remaining": "7",
      },
      body: MOCK_PROSE + STREAM_END,
    });
  });

  await page.goto("/");

  // Start: the generation is running, with the hand-written description showing.
  const stop = page.getByRole("button", { name: "Stop" });
  await expect(stop).toBeVisible();
  await expect(page.getByText("The room comes into focus…")).toBeVisible();
  await expect(page.getByText("A cold, dust-sheeted hall.")).toBeVisible();
  await expect(page.getByTestId("generations-left")).toContainText("10 / 10");

  // Stop: the request is abandoned and the player can start again.
  await stop.click();
  const again = page.getByRole("button", { name: "Generate again" });
  await expect(again).toBeVisible();
  await expect(stop).toHaveCount(0);
  await expect(page.getByText(MOCK_PROSE)).toHaveCount(0);

  // Retry: the provider answers; the text appears and the count updates.
  answer = true;
  const callsBeforeRetry = calls;
  await again.click();
  await expect(page.getByText(MOCK_PROSE)).toBeVisible();
  expect(calls).toBeGreaterThan(callsBeforeRetry);
  await expect(stop).toHaveCount(0);
  await expect(again).toHaveCount(0);
  await expect(page.getByTestId("generations-left")).toContainText("7 / 10");

  // Anything still held from the abandoned attempt is simply dropped.
  await Promise.all(held.map((r) => r.abort().catch(() => {})));
});
