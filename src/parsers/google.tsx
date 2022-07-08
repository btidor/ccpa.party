import { DateTime } from "luxon";
import { Minimatch } from "minimatch";

import type {
  IgnoreParser,
  MetadataParser,
  Parser,
  TimelineParser,
} from "@src/common/parser";
import type { CategoryKey } from "@src/providers/google";
import { parseJSON } from "@src/worker/parse";

const decoder = new TextDecoder();

class Google implements Parser<CategoryKey> {
  slug = "google";

  ignore: ReadonlyArray<IgnoreParser> = [
    { glob: new Minimatch("**") }, // for now
  ];

  metadata: ReadonlyArray<MetadataParser> = [
    {
      glob: new Minimatch("Takeout/Hangouts/Hangouts.json"),
      tokenize: (data) =>
        parseJSON(data).conversations.flatMap(
          (c: { conversation: { conversation: unknown } }) =>
            c.conversation.conversation
        ),
      parse: (item) => [`hangouts.${item.id.id}`, item],
    },
  ];

  timeline: ReadonlyArray<TimelineParser<CategoryKey>> = [
    {
      glob: new Minimatch("**/*.eml"),
      tokenize: (data) => [decoder.decode(data)],
      parse: (item: string) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        let from = item.match(/^From: (.*)$/m)![1];
        from = from.match(/^(.*) <[^>]+>$/)?.[1] || from;
        from = from.match(/"([^"]+)"$/)?.[1] || from;
        from = from.match(/<([^>]+)>$/)?.[1] || from;

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const subject = item.match(/^Subject: (.*)$/m)![1];
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const date = item.match(/^From [^ ]+ (.*)$/m)![1];
        return [
          "mail",
          DateTime.fromFormat(date, "EEE MMM dd HH:mm:ss ZZZ yyyy"),
          [subject, from],
        ];
      },
    },
    {
      glob: new Minimatch("Takeout/Access Log Activity/Activities - *.csv"),
      parse: (item) => [
        "security",
        DateTime.fromSQL(item["Activity Timestamp"]),
        [
          item["Product Name"] === "Other"
            ? "Activity"
            : `Accessed ${item["Product Name"]}`,
          `from ${item["IP Address"]}`,
        ],
      ],
    },
    {
      glob: new Minimatch("Takeout/Drive/**/*-info.json"),
      tokenize: (data) => [parseJSON(data)],
      parse: (item) =>
        item.last_modified_by_me
          ? [
              "activity",
              DateTime.fromISO(item.last_modified_by_me),
              [`Edited "${item.title}"`, "Google Drive"],
            ]
          : undefined,
    },
    {
      glob: new Minimatch("Takeout/My Activity/*/MyActivity.json"),
      parse: (item) => {
        let { title, header } = item;
        if (
          item.details?.some(
            (x: { name: string }) => x.name === "From Google Ads"
          )
        )
          header = "Google Ads";
        if (
          header === "Maps" &&
          item.titleUrl?.startsWith("https://www.google.com/maps/place/")
        )
          title = `Viewed ${title}`;
        return ["activity", DateTime.fromISO(item.time), [title, header]];
      },
    },
    {
      glob: new Minimatch("Takeout/Hangouts/Hangouts.json"),
      tokenize: (data) =>
        parseJSON(data).conversations.flatMap(
          (c: { events: unknown }) => c.events
        ),
      parse: (item) => {
        if (item.event_type !== "REGULAR_CHAT_MESSAGE") {
          throw new Error("Unknown item type: " + item.event_type);
        }
        return ["chat", DateTime.fromMillis(item.timestamp / 1000), null];
      },
    },
  ];
}

export default Google;
