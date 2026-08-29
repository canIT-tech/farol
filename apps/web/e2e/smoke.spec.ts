import { test, expect } from "@playwright/test";

test("a home carrega", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Farol" })).toBeVisible();
});
