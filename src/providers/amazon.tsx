import type { Provider, TimelineCategory } from "@src/common/provider";

export type CategoryKey = "activity" | "billing" | "notification" | "order";

class Amazon implements Provider<CategoryKey> {
  slug = "amazon";
  displayName = "Amazon";

  brandColor = "#ff9900";
  neonColor = "#ff7100";
  neonColorHDR = "color(rec2020 0.84192 0.48607 -0.05713)";

  requestLink = {
    text: "Request My Data",
    href: "https://amazon.com/gp/privacycentral/dsar/preview.html",
  };
  waitTime = "1-2 days";
  instructions: ReadonlyArray<string> = [];
  singleFile = false;
  fileName = "zip files";
  privacyPolicy =
    "https://www.amazon.com/gp/help/customer/display.html?nodeId=GC5HB5DVMU5Y8CJ2";

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
      "notification",
      {
        char: "n",
        icon: "🔔",
        displayName: "Notifications",
        defaultEnabled: false,
      },
    ],
    [
      "order",
      {
        char: "o",
        icon: "🚚",
        displayName: "Orders",
        defaultEnabled: true,
      },
    ],
  ]);
}

export default Amazon;
