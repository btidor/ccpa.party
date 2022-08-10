import type { Provider, TimelineCategory } from "@src/common/provider";

export type CategoryKey =
  | "activity"
  | "billing"
  | "calendar"
  | "chat"
  | "mail"
  | "security";

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
    `click Multiple Formats`,
    `change HTML to JSON`,
  ];
  singleFile = false;
  fileName = "zip/mbox files";
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
      "billing",
      {
        char: "b",
        icon: "💵",
        displayName: "Billing",
        defaultEnabled: true,
      },
    ],
    [
      "calendar",
      {
        char: "c",
        icon: "📆",
        displayName: "Calendar",
        defaultEnabled: true,
      },
    ],
    [
      "chat",
      {
        char: "h",
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
