import { expect, test } from "@playwright/test";

test("home page renders", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("ccpa.party");

  const logo = page.locator("span", { hasText: /ccpa\.party/i });
  await expect(logo).toBeVisible();

  const provider = page.locator("a", { hasText: /facebook/i });
  await expect(provider).toBeVisible();
});

test("request page renders", async ({ page }) => {
  await page.goto("/github");

  const logo = page.locator("span", { hasText: /ccpa\.party/i });
  await expect(logo).toBeVisible();

  const link = page.locator("a", { hasText: /account settings/i });
  await expect(link).toHaveAttribute(
    "href",
    "https://github.com/settings/admin"
  );

  const info = page.locator("code", { hasText: /results in 15 minutes/i });
  await expect(info).toBeVisible();

  const button = page.locator("label[for='import']");
  await expect(button).toBeVisible();
});
