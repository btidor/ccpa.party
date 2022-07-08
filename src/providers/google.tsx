import type { Provider, TimelineCategory } from "@src/common/provider";

export type CategoryKey = "activity" | "chat" | "mail" | "security";

class Google implements Provider<CategoryKey> {
  slug = "google";
  displayName = "Google";

  brandColor = "#34a853";
  neonColor = "#00c300";
  neonColorHDR = "color(rec2020 0.1856 0.71527 0.06415)";

  requestLink = {
    text: "Google Takeout",
    href: "https://takeout.google.com/",
  };
  waitTime = "1-2 days";
  instructions: ReadonlyArray<string> = [
    `check Access Log Activity`,
    ``,
    `under My Activity`,
    ` click Multiple Formats`,
    `  change HTML to JSON`,
  ];
  singleFile = true;
  fileName = "takeout.zip";
  privacyPolicy = "https://policies.google.com/privacy?hl=en#california";

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
      "chat",
      {
        char: "c",
        icon: "💬",
        displayName: "Chat",
        defaultEnabled: true,
      },
    ],
    [
      "mail",
      {
        char: "m",
        icon: "✉️",
        displayName: "Mail",
        defaultEnabled: true,
      },
    ],
    [
      "security",
      {
        char: "s",
        icon: "🪪",
        displayName: "Security Logs",
        defaultEnabled: false,
      },
    ],
  ]);
}

export default Google;
