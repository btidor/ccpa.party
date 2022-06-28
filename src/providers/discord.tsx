import { DateTime } from "luxon";
import { Minimatch } from "minimatch";

import { IgnoreParser, parseJSON, parseJSONND } from "@src/common/parse";
import type { MetadataParser, TimelineParser } from "@src/common/parse";
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

  ignoreParsers: ReadonlyArray<IgnoreParser> = [
    { glob: new Minimatch("README.txt") },
    { glob: new Minimatch("account/avatar.png") },
    { glob: new Minimatch("account/user.json") },
    { glob: new Minimatch("servers/*/audit-log.json") },
    { glob: new Minimatch("servers/*/guild.json") },
  ];

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

  metadataParsers: ReadonlyArray<MetadataParser> = [
    {
      glob: new Minimatch("servers/index.json"),
      tokenize: (data) => Object.entries(parseJSON(data)),
      parse: ([k, v]) => [`server.${k}`, v],
    },
    {
      glob: new Minimatch("messages/index.json"),
      tokenize: (data) => Object.entries(parseJSON(data)),
      parse: ([k, v]) => [`channel.${k}`, v],
    },
    {
      glob: new Minimatch("messages/*/channel.json"),
      tokenize: (data) => [parseJSON(data)],
      parse: (item) => [`channel_meta.${item.id}`, item],
    },
  ];

  timelineParsers: ReadonlyArray<TimelineParser<CategoryKey>> = [
    {
      glob: new Minimatch("messages/*/messages.csv"),
      parse: (item) => [
        "message",
        DateTime.fromJSDate(new Date(item.Timestamp)),
        null,
      ],
    },
    {
      glob: new Minimatch("activity/*/events-*.json"),
      tokenize: parseJSONND,
      parse: (item) => [
        "activity",
        DateTime.fromISO(item.timestamp.slice(1, -1)),
        null,
      ],
    },
  ];
}

export default Discord;
