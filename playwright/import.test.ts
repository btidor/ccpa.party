import { expect, test } from "@playwright/test";

test("tar.gz import", async ({ page }) => {
  await page.goto("/github");

  const compass = page
    .locator("div", { has: page.locator("input#import") })
    .last();
  await expect(compass).toContainText(/import tar\.gz file/i);

  page
    .waitForEvent("filechooser")
    .then((chooser) => chooser.setFiles("playwright/github.tar.gz"));
  await page.locator("label[for='import']").click();
  await expect(compass).toContainText(/explore/i);

  await compass.locator("a").click(); // Explore ->

  await page.locator("span", { hasText: /successfully deployed to/i }).click();
  expect(await page.locator("pre").last()).toContainText(
    /"commit_id": "d1b0afe149159c278113a4bd110d3bd4cd7c4250",/i,
  );

  await page.locator("a", { hasText: /files/i }).click(); // files
  await page
    .locator("div", { hasText: /repositories_000001.json/i })
    .last()
    .click();
  expect(await page.locator("pre").last()).toContainText(
    /"url": "https:\/\/github.com\/btidor\/ccpa.party",/i,
  );
});

test("zip import", async ({ page }) => {
  await page.goto("/slack");

  const compass = page
    .locator("div", { has: page.locator("input#import") })
    .last();
  await expect(compass).toContainText(/import zip file/i);

  page
    .waitForEvent("filechooser")
    .then((chooser) => chooser.setFiles("playwright/slack.zip"));
  await page.locator("label[for='import']").click();
  await expect(compass).toContainText(/explore/i);

  await compass.locator("a").click(); // Explore ->

  await page
    .locator("span", { hasText: /hello, world!/i })
    .last()
    .click();
  expect(await page.locator("pre").last()).toContainText(
    /"client_msg_id": "20848668-047f-44b9-a314-0d1f44ed8d5c",/i,
  );

  await page.locator("a", { hasText: /files/i }).click(); // files
  await page
    .locator("div", { hasText: /ccpa-discuss/i })
    .last()
    .click();
  await page
    .locator("div", { hasText: /2022-06-30/i })
    .last()
    .click();
  expect(await page.locator("pre").last()).toContainText(
    /\[\s*{\s*"client_msg_id":/i,
  );
});
