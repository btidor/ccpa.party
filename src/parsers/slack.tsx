import { DateTime } from "luxon";
import { Minimatch } from "minimatch";

import type {
  IgnoreParser,
  MetadataParser,
  Parser,
  TimelineParser,
} from "@src/common/parser";
import type { CategoryKey } from "@src/providers/slack";

class Slack implements Parser<CategoryKey> {
  slug = "slack";

  ignore: ReadonlyArray<IgnoreParser> = [];

  metadata: ReadonlyArray<MetadataParser> = [
    {
      glob: new Minimatch("users.json"),
      parse: (item) => [`user.${item.id}`, item],
    },
    {
      glob: new Minimatch("channels.json"),
      parse: (item) => [`channel.${item.id}`, item],
    },
  ];

  timeline: ReadonlyArray<TimelineParser<CategoryKey>> = [
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
