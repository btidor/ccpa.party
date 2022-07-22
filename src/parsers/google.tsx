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

class Google implements Parser<CategoryKey> {
  decoder: TextDecoder;

  constructor() {
    this.decoder = new TextDecoder();
  }

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
      tokenize: (data, go) => [go.ParseEmail(new Uint8Array(data))],
      parse: (item: string) => {
        const parts = item.split(/\r?\n/);
        const headers = {} as { [key: string]: string };
        for (let i = 0; i < parts.length; i++) {
          if (parts[i] === "") {
            break;
          } else if (parts[i].startsWith("From ")) {
            const subparts = parts[i].split(" ");
            headers["Date"] = subparts.slice(2).join(" ");
          } else {
            const [name, ...value] = parts[i].split(": ");
            headers[name] = value.join(": ");
          }
        }

        const labels = (headers["X-Gmail-Labels"] || "").split(",");
        const date = DateTime.fromFormat(
          headers["Date"],
          "EEE MMM dd HH:mm:ss ZZZ yyyy"
        );

        const subject = headers["Subject"];

        const matches = headers["From"].trim().match(/^((.*) )?(<([^>]+)>)?$/);
        let from = (matches?.[2] || matches?.[5] || headers["From"]).trim();
        if (from.at(0) === '"' && from.at(-1) === '"') {
          from = from.slice(1, -1);
        }

        if (labels.includes("Trash") || labels.includes("Spam")) {
          // TODO: for now, completely hide messages in Trash + Spam
          return undefined;
        } else if (labels.includes("Chat")) {
          // Skip chat messages, they're duplicated in the Hangouts export (and
          // are provided here without the recipient...?)
          return undefined;
        } else {
          return ["mail", date, [subject, from]];
        }
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
