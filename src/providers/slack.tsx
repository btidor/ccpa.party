import type { Provider, TimelineCategory } from "@src/common/provider";

export type CategoryKey = "message" | "integration";

class Slack implements Provider<CategoryKey> {
  slug = "slack";
  displayName = "Slack";

  brandColor = "#4a154b";
  neonColor = "#f0f";
  neonColorHDR = "color(rec2020 0.92827 0.25757 1.11361)";

  requestLink = {
    text: "Export Workspace Data",
    href: "https://slack.com/help/articles/201658943-Export-your-workspace-data",
  };
  waitTime = "a few days";
  instructions: ReadonlyArray<string> = [];
  singleFile = true;
  fileName = "zip file";
  privacyPolicy =
    "https://slack.com/trust/privacy/privacy-policy#california-rights";
  // Also: https://slack.com/trust/compliance/ccpa-faq

  timelineCategories: ReadonlyMap<CategoryKey, TimelineCategory> = new Map([
    [
      "message",
      {
        char: "m",
        icon: "",
        displayName: "Messages",
        defaultEnabled: true,
      },
    ],
    [
      "integration",
      {
        char: "i",
        icon: "",
        displayName: "Integration Logs",
        defaultEnabled: false,
      },
    ],
  ]);
}

export default Slack;
