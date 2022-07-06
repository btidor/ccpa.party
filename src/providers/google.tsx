import { DateTime } from "luxon";
import { Minimatch } from "minimatch";

import { parseJSON } from "@src/common/parse";
import type {
  IgnoreParser,
  MetadataParser,
  TimelineParser,
} from "@src/common/parse";
import type { Provider, TimelineCategory } from "@src/common/provider";

export type CategoryKey = "activity" | "chat" | "mail" | "security";

const decoder = new TextDecoder();

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
    ` click Multiple Formats`,
    `  change HTML to JSON`,
  ];
  singleFile = true;
  fileName = "takeout.zip";
  privacyPolicy = "https://policies.google.com/privacy?hl=en#california";

  ignoreParsers: ReadonlyArray<IgnoreParser> = [
    { glob: new Minimatch("**") }, // for now
  ];

  metadataParsers: ReadonlyArray<MetadataParser> = [
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
      "chat",
      {
        char: "c",
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

  timelineParsers: ReadonlyArray<TimelineParser<CategoryKey>> = [
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
