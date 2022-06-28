import { DateTime } from "luxon";
import { Minimatch } from "minimatch";

import { MetadataParser, TimelineParser } from "@src/common/parse";
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

  metadataParsers: ReadonlyArray<MetadataParser> = [
    {
      glob: new Minimatch("users.json"),
      parse: (item) => [`user.${item.id}`, item],
    },
    {
      glob: new Minimatch("channels.json"),
      parse: (item) => [`channel.${item.id}`, item],
    },
  ];

  timelineParsers: ReadonlyArray<TimelineParser<CategoryKey>> = [
    {
      glob: new Minimatch("*/*.json"),
      parse: (item) => [
        "message",
        DateTime.fromSeconds(parseInt(item.ts)),
        null,
      ],
    },
    {
      glob: new Minimatch("integration_logs.json"),
      parse: (item) => [
        "integration",
        DateTime.fromSeconds(parseInt(item.date)),
        null,
      ],
    },
  ];
}

export default Slack;
