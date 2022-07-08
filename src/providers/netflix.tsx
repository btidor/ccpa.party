import type { Provider, TimelineCategory } from "@src/common/provider";

export type CategoryKey = "account" | "activity" | "notification";

class Netflix implements Provider<CategoryKey> {
  slug = "netflix";
  displayName = "Netflix";

  brandColor = "#e50914";
  neonColor = "#ff0006";
  neonColorHDR = "color(rec2020 1.0185 0.26889 0.13682)";

  requestLink = {
    text: "Get My Info",
    href: "https://www.netflix.com/account/getmyinfo",
  };
  waitTime = "a day";
  instructions: ReadonlyArray<string> = [];
  singleFile = true;
  fileName = "netflix.zip";
  privacyPolicy = "https://help.netflix.com/legal/privacy#ccpa";

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
        icon: "🎞",
        displayName: "Activity",
        defaultEnabled: true,
      },
    ],
    [
      "notification",
      {
        char: "n",
        icon: "🔔",
        displayName: "Notifications",
        defaultEnabled: false,
      },
    ],
  ]);
}

export default Netflix;
