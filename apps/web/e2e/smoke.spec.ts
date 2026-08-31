import { test, expect } from "@playwright/test";

test("a home carrega", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Você não precisa saber para onde ir." })
  ).toBeVisible();
});
