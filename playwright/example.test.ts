import { expect, test } from "@playwright/test";

test("homepage renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("ccpa.party");
  const logo = page.locator("text=ccpa.party");
  await expect(logo).toBeVisible();
  const provider = page.locator("a", { hasText: "facebook" });
  await expect(provider).toBeVisible;
});
