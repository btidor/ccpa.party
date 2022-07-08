import type { Provider, TimelineCategory } from "@src/common/provider";

export type CategoryKey =
  | "activity"
  | "content"
  | "message"
  | "notification"
  | "security";

class Facebook implements Provider<CategoryKey> {
  slug = "facebook";
  displayName = "Facebook";

  brandColor = "#1877f2";
  neonColor = "#009eff";
  neonColorHDR = "color(rec2020 0.12623 0.5874 1.52179)";

  requestLink = {
    text: "Download Your Information",
    href: "https://www.facebook.com/ccpa/download_your_information/",
  };
  waitTime = "1-2 hours";
  instructions: ReadonlyArray<string> = ["select format JSON"];
  singleFile = true;
  fileName = "facebook.zip";
  privacyPolicy = "https://www.facebook.com/legal/policy/ccpa";

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
      "content",
      {
        char: "c",
        icon: "📱",
        displayName: "Content",
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
    [
      "notification",
      {
        char: "n",
        icon: "🔔",
        displayName: "Notifications",
        defaultEnabled: false,
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

export default Facebook;
