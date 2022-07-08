import type { Provider, TimelineCategory } from "@src/common/provider";

export type CategoryKey = "account" | "activity" | "icloud" | "media";

class Apple implements Provider<CategoryKey> {
  slug = "apple";
  displayName = "Apple";

  brandColor = "#ffb900";
  neonColor = "#e08800";
  neonColorHDR = "color(rec2020 0.75646 0.54656 -0.09204)";

  requestLink = {
    text: "Data and Privacy",
    href: "https://privacy.apple.com/",
  };
  waitTime = "about a week";
  instructions: ReadonlyArray<string> = [];
  singleFile = false;
  fileName = "zip files";
  privacyPolicy = "https://www.apple.com/legal/privacy/california/";

  timelineCategories: ReadonlyMap<CategoryKey, TimelineCategory> = new Map([
    [
      "account",
      {
        char: "c",
        icon: "🪪",
        displayName: "Account",
        defaultEnabled: true,
      },
    ],
    [
      "activity",
      {
        char: "a",
        icon: "🖱",
        displayName: "Activity",
        defaultEnabled: false,
      },
    ],
    [
      "icloud",
      {
        char: "i",
        icon: "🌥",
        displayName: "iCloud",
        defaultEnabled: true,
      },
    ],
    [
      "media",
      {
        char: "m",
        icon: "🎶",
        displayName: "Media",
        defaultEnabled: true,
      },
    ],
  ]);
}

export default Apple;
