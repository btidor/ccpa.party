import type { Provider, TimelineCategory } from "@src/common/provider";

export type CategoryKey = "activity" | "message";

class Discord implements Provider<CategoryKey> {
  slug = "discord";
  displayName = "Discord";

  brandColor = "#5865f2";
  neonColor = "#4087ff";
  neonColorHDR = "color(rec2020 0.4889 0.52224 1.46496)";

  requestLink = {
    text: "Discord",
    href: "https://discord.com/app",
  };
  waitTime = "about a week";
  instructions: ReadonlyArray<string> = [
    "open User Settings",
    "Privacy & Safety tab",
    "scroll down",
  ];
  singleFile = true;
  fileName = "package.zip";
  privacyPolicy =
    "https://discord.com/privacy#information-for-california-users";

  timelineCategories: ReadonlyMap<CategoryKey, TimelineCategory> = new Map([
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
      "message",
      {
        char: "m",
        icon: "💬",
        displayName: "Sent Messages",
        defaultEnabled: true,
      },
    ],
  ]);
}

export default Discord;
