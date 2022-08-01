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
    // Settings
    { glob: new Minimatch("Takeout/Classic Sites/**") },
    { glob: new Minimatch("Takeout/Contacts/**") },
    { glob: new Minimatch("Takeout/Google Business Profile/**") },
    { glob: new Minimatch("Takeout/Google Play Books/**/*.json") },
    { glob: new Minimatch("Takeout/Groups/**/info.csv") },
    { glob: new Minimatch("Takeout/Groups/**/members.csv") },
    { glob: new Minimatch("Takeout/Groups/**/user data/**") },
    { glob: new Minimatch("Takeout/Mail/User Settings/**") },
    { glob: new Minimatch("Takeout/News/**") },
    { glob: new Minimatch("Takeout/Profile/**") },
    { glob: new Minimatch("Takeout/Tasks/**") },

    // Attachments
    { glob: new Minimatch("Takeout/Google Chat/**") },

    // Duplicate
    { glob: new Minimatch("Takeout/Hangouts/**") },
    { glob: new Minimatch("Takeout/Google Play Store/Order History.json") },
    { glob: new Minimatch("Takeout/Google Play Store/Promotion History.json") },
    { glob: new Minimatch("Takeout/Google Play Store/Purchase History.json") },
    {
      glob: new Minimatch("Takeout/Google Play Store/Redemption History.json"),
    },
    { glob: new Minimatch("Takeout/Google Play Store/Subscriptions.json") },

    // Miscellaneous & Unparseable
    { glob: new Minimatch("Takeout/archive_browser.html") },
    {
      glob: new Minimatch(
        "Takeout/Google Pay/**/Loyalty Gift Cards and Offers.pdf"
      ),
    },
    { glob: new Minimatch("Takeout/My Activity/**/*.html") },
    { glob: new Minimatch("Takeout/Google Account/**.html") },
    { glob: new Minimatch("**/README") },
  ];

  metadata: ReadonlyArray<MetadataParser> = [
    {
      glob: new Minimatch("Takeout/Google Chat/**/group_info.json"),
      tokenize: (data, path) => [{ ...parseJSON(data), _group: path.at(-2) }],
      parse: (item) => [`chat.${item._group}`, item],
    },
    {
      glob: new Minimatch("Takeout/Google Chat/Users/User */user_info.json"),
      tokenize: (data) => [parseJSON(data)],
      parse: (item) => ["chat.user_info", item],
    },
  ];

  timeline: ReadonlyArray<TimelineParser<CategoryKey>> = [
    {
      glob: new Minimatch("**/*.eml"),
      tokenize: (data, _, go) => [go.ParseEmail(new Uint8Array(data))],
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
      glob: new Minimatch("Takeout/Google Chat/**/messages.json"),
      tokenize: (data) => parseJSON(data).messages,
      parse: (item) => {
        return [
          "chat",
          DateTime.fromFormat(item.created_date, "DDDD 'at' tt 'UTC'", {
            zone: "UTC",
          }),
          null,
        ];
      },
    },
    {
      glob: new Minimatch("Takeout/Calendar/*.ics"),
      tokenize: (data) => {
        const lines = this.decoder
          .decode(data)
          .replace(/\r?\n /g, "")
          .split(/\r?\n/);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scanning = [{}] as any[];
        let calendar;
        for (const line of lines) {
          const lparts = line.split(":");
          const kparts = lparts[0].split(";");
          const key = kparts[0];
          const params = {} as { [key: string]: string };
          kparts.slice(1).forEach((param) => {
            const pparts = param.split("=");
            params[pparts[0]] = pparts.slice(1).join("=");
          });
          const value = lparts.slice(1).join(":");
          if (key === "BEGIN") {
            scanning.push(
              value === "VEVENT"
                ? { _value: value, CALENDAR: calendar }
                : { _value: value }
            );
          } else if (key === "END") {
            const { _value, ...rest } = scanning.pop() || {};
            const previous = scanning.at(-1);
            if (previous) {
              previous[_value as string] ||= [];
              (previous[_value as string] as unknown[]).push(rest);
            }
          } else if (key === "X-WR-CALNAME") {
            calendar = value;
          } else {
            const previous = scanning.at(-1);
            if (previous) {
              const object = Object.keys(params).length
                ? { ...params, _: value }
                : value;
              if (key === "ATTENDEE") {
                previous[key] ||= [];
                previous[key].push(object);
              } else {
                previous[key] = object;
              }
            }
          }
        }
        return scanning[0].VCALENDAR[0].VEVENT;
      },
      parse: (item) => {
        const date =
          typeof item.DTSTART === "string"
            ? DateTime.fromISO(item.DTSTART)
            : DateTime.fromISO(item.DTSTART._, {
                zone: item.DTSTART.TZID,
              });
        return ["calendar", date, [item.SUMMARY, item.CALENDAR]];
      },
    },
    {
      glob: new Minimatch(
        "Takeout/Google Pay/Google transactions/transactions_*.csv"
      ),
      parse: (item) => {
        return [
          "billing",
          DateTime.fromFormat(item.Time, "MMM d, yyyy, h:mm a"),
          [`Paid ${item.Amount}`, item.Product],
        ];
      },
    },
    {
      glob: new Minimatch(
        "Takeout/Google Pay/Money sends and requests/Money sends and requests.csv"
      ),
      parse: (item) => {
        return [
          "billing",
          DateTime.fromFormat(item.Time, "MMM d, yyyy, h:mm a"),
          [`${item.Status} Transfer`, item.Memo],
        ];
      },
    },
    {
      glob: new Minimatch("Takeout/Google Play Store/Library.json"),
      parse: (item) => {
        return [
          "billing",
          DateTime.fromISO(item.libraryDoc.acquisitionTime),
          [
            `Added ${item.libraryDoc.doc.documentType} to Library`,
            item.libraryDoc.doc.title,
          ],
        ];
      },
    },
  ];
}

export default Google;
