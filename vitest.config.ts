import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Playwright specs live in e2e/ and run with `npm run test:e2e`.
    exclude: ["**/node_modules/**", "e2e/**"],
  },
});
