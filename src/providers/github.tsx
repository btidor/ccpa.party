import type { Provider, TimelineCategory } from "@src/common/provider";

export type CategoryKey = "activity" | "message";

class GitHub implements Provider<CategoryKey> {
  slug = "github";
  displayName = "GitHub";

  brandColor = "#6e5494";
  neonColor = "#bd65ff";
  neonColorHDR = "color(rec2020 0.69493 0.4398 1.36255)";

  requestLink = {
    text: "Account Settings",
    href: "https://github.com/settings/admin",
  };
  waitTime = "15 minutes";
  instructions: ReadonlyArray<string> = [];
  singleFile = true;
  fileName = "tar.gz file";
  privacyPolicy =
    "https://docs.github.com/en/site-policy/privacy-policies/githubs-notice-about-the-california-consumer-privacy-act";

  timelineCategories: ReadonlyMap<CategoryKey, TimelineCategory> = new Map([
    [
      "activity",
      {
        char: "a",
        icon: "🖱",
        displayName: "Activity",
        defaultEnabled: true,
      },
    ],
    [
      "message",
      {
        char: "m",
        icon: "💬",
        displayName: "Messages",
        defaultEnabled: true,
      },
    ],
  ]);
}

export default GitHub;
