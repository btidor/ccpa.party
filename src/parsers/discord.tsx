import { DateTime } from "luxon";
import { Minimatch } from "minimatch";

import type {
  IgnoreParser,
  MetadataParser,
  TimelineParser,
} from "@src/common/parser";
import type { Parser } from "@src/common/parser";
import type { CategoryKey } from "@src/providers/discord";
import { parseJSON, parseJSONND } from "@src/worker/parse";

class Discord implements Parser<CategoryKey> {
  slug = "discord";

  ignore: ReadonlyArray<IgnoreParser> = [
    { glob: new Minimatch("README.txt") },
    { glob: new Minimatch("account/avatar.png") },
    { glob: new Minimatch("account/user.json") },
    { glob: new Minimatch("servers/*/audit-log.json") },
    { glob: new Minimatch("servers/*/guild.json") },
  ];

  metadata: ReadonlyArray<MetadataParser> = [
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

  timeline: ReadonlyArray<TimelineParser<CategoryKey>> = [
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
