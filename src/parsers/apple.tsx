import { DateTime } from "luxon";
import { Minimatch } from "minimatch";
import plist from "plist";

import type {
  IgnoreParser,
  Parser,
  TimelineParser,
  TimelineTuple,
  TokenizedItem,
} from "@src/common/parser";
import type { CategoryKey } from "@src/providers/apple";
import { parseCSV, parseJSON, smartDecode } from "@src/worker/parse";

class Apple implements Parser<CategoryKey> {
  slug = "apple";

  ignore: ReadonlyArray<IgnoreParser> = [
    // Duplicate
    { glob: new Minimatch("**/Apple Music - Container Details.csv") },
    { glob: new Minimatch("**/Apple Music - Container Origin.csv") },
    { glob: new Minimatch("**/Apple Music - Play History Daily Tracks.csv") },
    { glob: new Minimatch("**/Apple Music - Recently Played Containers.csv") },
    { glob: new Minimatch("**/Apple Music - Recently Played Tracks.csv") },
    { glob: new Minimatch("**/Apple Music - Top Content.csv") },
    { glob: new Minimatch("**/Account and Transaction History/**") },
    { glob: new Minimatch("**/iTunes Payment Stack - Activity.csv") },
    {
      glob: new Minimatch(
        "iCloud Drive/System Data/shoebox/UbiquitousCards/**"
      ),
    },

    // Settings
    { glob: new Minimatch("**/Music - Onboarding Artists.csv") },
    { glob: new Minimatch("**/Music - Onboarding Genres.csv") },
    { glob: new Minimatch("**/Apple Books Collection Information.json") },
    { glob: new Minimatch("**/Apple One Offer Information.csv") },
    { glob: new Minimatch("vCards/**") },
    {
      glob: new Minimatch(
        "iCloud Drive/System Data/TextInput/Dictionaries/**",
        { dot: true }
      ),
    },
  ];

  timeline: ReadonlyArray<TimelineParser<CategoryKey>> = [
    {
      glob: new Minimatch("**/Apple ID Account Information.csv"),
      parse: (item) => [
        "account",
        DateTime.fromSQL(item["Last Update Date"], {
          zone: "UTC",
        }),
        ["Updated Apple ID account information"],
      ],
    },
    {
      glob: new Minimatch("**/Apple ID Device Information.csv"),
      parse: (item) => [
        [
          "account",
          DateTime.fromSQL(item["Device Added Date"], {
            zone: "UTC",
          }),
          ["Added Device", item["Device Name"]],
        ],
        [
          "account",
          DateTime.fromSQL(item["Device Last Heartbeat Timestamp"], {
            zone: "UTC",
          }),
          [
            "Device Last Heartbeat",
            `${item["Device Name"]} at ${item["Device Last Heartbeat IP"]}`,
          ],
        ],
      ],
    },
    {
      glob: new Minimatch("**/Apple ID SignOn Information.csv"),
      parse: (item) => [
        "account",
        DateTime.fromSQL(item["Logged In Date"], {
          zone: "UTC",
        }),
        [
          "Latest Sign-on",
          item["Application"] +
            (item["IP Address"] !== "N/A" ? ` from ${item["IP Address"]}` : ""),
        ],
      ],
    },
    {
      glob: new Minimatch("**/Data & Privacy Request History.csv"),
      parse: (item) => [
        "account",
        DateTime.fromSQL(item["Request Time"], {
          zone: "UTC",
        }),
        ["Submitted Data & Privacy Request"],
      ],
    },
    {
      glob: new Minimatch("**/Apple Music Likes and Dislikes.csv"),
      parse: (item) => [
        "media",
        DateTime.fromISO(item["Created"]),
        [
          (item["Preference"] === "LOVE"
            ? "Loved"
            : item["Preference"] === "DISLIKE"
            ? "Disliked"
            : "Marked") + " Track",
          item["Item Description"],
        ],
      ],
    },
    {
      glob: new Minimatch("**/Apple Music Play Activity.csv"),
      parse: (item) =>
        item["Song Name"]
          ? [
              "media",
              DateTime.fromISO(
                item["Event Start Timestamp"] || item["Event End Timestamp"]
              ),
              [
                item["Event Type"] === "PLAY_END"
                  ? "Played Track"
                  : item["Event Type"] === "LYRIC_DISPLAY"
                  ? "Viewed Lyrics"
                  : "Media Event",
                item["Song Name"],
              ],
            ]
          : undefined,
    },
    {
      glob: new Minimatch(
        "**/Customer Device History - Computer Authorizations.csv"
      ),
      parse: (item) => [
        "account",
        DateTime.fromISO(item["Associated Date"]),
        ["Authorized iTunes", item["Device Name"]],
      ],
    },
    {
      glob: new Minimatch("**/In-App Subscription Family Sharing History.csv"),
      parse: (item) => [
        "account",
        DateTime.fromISO(item["Last Modified Date"]),
        [
          item["Family Sharing Enabled"] === "Yes"
            ? "Shared App with Family"
            : "Un-shared App with Family",
          item["App Name"],
        ],
      ],
    },
    {
      glob: new Minimatch("**/Store Free Transaction History.csv"),
      parse: (item) => [
        "account",
        DateTime.fromISO(item["Item Purchased Date"]),
        ["Purchased App", item["Item Description"]],
      ],
    },
    {
      glob: new Minimatch("**/Store Transaction History.csv"),
      parse: (item) => [
        "account",
        DateTime.fromISO(item["Item Purchased Date"]),
        [
          `Purchased ${
            item["Content Type"].includes("Apps")
              ? "App"
              : item["Content Type"].endsWith("s")
              ? item["Content Type"].slice(0, -1)
              : item["Content Type"]
          }`,
          item["Item Description"],
        ],
      ],
    },
    {
      glob: new Minimatch("**/TV App Favorites and Activity.json"),
      tokenize: (data) => parseJSON(data).events,
      parse: (item) => [
        "media",
        DateTime.fromMillis(item.stored_event.timestamp),
        [
          "Watched Media",
          item.event_interpretation.human_readable_media_description,
        ],
      ],
    },
    {
      glob: new Minimatch("**/App Store Click Activity.csv"),
      parse: (item) => {
        let type = item["Event Type"];
        type = type[0].toUpperCase() + type.slice(1);
        return [
          "activity",
          DateTime.fromISO(item["Event Date Time"]),
          [
            `${type} Event`,
            item["App"] || item["App Name"] || item["Media Bundle App Name"],
          ],
        ];
      },
    },
    {
      glob: new Minimatch("**/Apple Music Click Activity.csv"),
      parse: (item) => {
        let type = item["Event Type"];
        type = type[0].toUpperCase() + type.slice(1);
        return [
          "activity",
          DateTime.fromISO(item["Event Date Time"]),
          [
            `${type} Event`,
            item["App"] || item["App Name"] || item["Media Bundle App Name"],
          ],
        ];
      },
    },
    {
      glob: new Minimatch("**/Apps And Service Analytics.csv"),
      parse: (item) => {
        let type = item["Event Type"];
        type = type[0].toUpperCase() + type.slice(1);
        return [
          "activity",
          DateTime.fromISO(item["Event Date Time"]),
          [
            `${type} Event`,
            item["App"] || item["App Name"] || item["Media Bundle App Name"],
          ],
        ];
      },
    },
    {
      glob: new Minimatch("**/TV App with Channel Support Click Activity.csv"),
      parse: (item) => {
        let type = item["Event Type"];
        type = type[0].toUpperCase() + type.slice(1);
        return [
          "activity",
          DateTime.fromISO(item["Event Date Time"]),
          [
            `${type} Event`,
            item["App"] || item["App Name"] || item["Media Bundle App Name"],
          ],
        ];
      },
    },
    {
      glob: new Minimatch("**/Limit Ad Tracking Information.csv"),
      parse: (item) => [
        "account",
        DateTime.fromISO(item["Created Date"]),
        ["Limited Ad Tracking"],
      ],
    },
    {
      glob: new Minimatch("**/Direct Top-Up Promotions.csv"),
      parse: (item) => [
        "account",
        DateTime.fromSQL(item["Promotion Start Date"]),
        ["Offered Promotion", item["Promotion Details"]],
      ],
    },
    {
      glob: new Minimatch("**/Game Center Data.json"),
      tokenize: async (data) =>
        (await parseJSON(data)).games_state.flatMap(
          ({
            leaderboard,
            achievements,
            ...game
          }: {
            leaderboard: { leaderboard_score: { [key: string]: unknown }[] }[];
            achievements: { a: number; [key: string]: unknown }[];
          }) => {
            const x = (leaderboard || []).flatMap(
              ({ leaderboard_score, ...leaderboard }) =>
                leaderboard_score.map((score) => ({
                  type: "leaderboard",
                  game,
                  leaderboard,
                  ...score,
                }))
            ) as TokenizedItem[];
            const y = (achievements || []).map((item) => ({
              type: "achievement",
              game,
              ...item,
            }));
            return x.concat(y);
          }
        ),
      parse: (item) =>
        item.type === "leaderboard"
          ? [
              "icloud",
              DateTime.fromFormat(
                item.submitted_time_utc,
                "MM/dd/yyyy HH:mm:ss"
              ),
              [
                "Game Center Leaderboard",
                `${item.leaderboard.leaderboard_title} in ${item.game.game_name}`,
              ],
            ]
          : [
              "icloud",
              DateTime.fromFormat(item.last_update_utc, "MM/dd/yyyy HH:mm:ss"),
              [
                "Game Center Achievement",
                `${item.achievements_title} in ${item.game.game_name}`,
              ],
            ],
    },
    {
      glob: new Minimatch(
        "**/iTunes and App-Book Re-download and Update History.csv"
      ),
      parse: (item) => [
        "activity",
        DateTime.fromISO(item["Activity Date"], { zone: "UTC" }),
        ["Updated App", item["Item Description"]],
      ],
    },
    {
      glob: new Minimatch("**/Online Purchase History.csv"),
      tokenize: async (data) => (await parseCSV(data)).slice(1),
      parse: (item) => [
        "account",
        DateTime.fromISO(item["Order Date"], {
          zone: "UTC",
        }),
        ["Placed Online Order", item["Description"]],
      ],
    },
    {
      glob: new Minimatch("**/AppleCare Partners Repairs and Service.csv"),
      tokenize: (data) =>
        parseCSV(smartDecode(data).split("\n").slice(4, -1).join("\n")),
      parse: (item) => [
        "account",
        DateTime.fromISO(item["TimeStamp"], {
          zone: "UTC",
        }),
        ["AppleCare Repair", item["Serial Number"]],
      ],
    },
    {
      glob: new Minimatch("**/AppleCare Repairs and Service.csv"),
      tokenize: (data) =>
        parseCSV(smartDecode(data).split("\n").slice(0, -1).join("\n")),
      parse: (item) => [
        "account",
        DateTime.fromISO(item["Repair Created Date"], {
          zone: "UTC",
        }),
        ["AppleCare Repair", item["Serial Number"]],
      ],
    },
    {
      glob: new Minimatch("**/AppleCare Cases.csv"),
      tokenize: (data) =>
        parseCSV(smartDecode(data).split("\n").slice(0, -3).join("\n")),
      parse: (item) => [
        "account",
        DateTime.fromISO(item["Creation Date"]),
        ["Created AppleCare Case", item["Case Title"]],
      ],
    },
    {
      glob: new Minimatch("**/AppleCare Device Details.csv"),
      tokenize: async (data) => {
        const parts = smartDecode(data).split(/\n\n+/);
        const purchases = (await parseCSV(parts[0])).map((item) => ({
          type: "purchase",
          ...item,
        }));
        const warranties = (await parseCSV(parts[1])).map((item) => ({
          type: "warranty",
          ...item,
        }));
        return purchases.concat(warranties);
      },
      parse: (item) =>
        item.type === "purchase"
          ? [
              "account",
              DateTime.fromISO(item["Purchase Date"]),
              ["Purchased Device", item["Product Description"]],
            ]
          : [
              "account",
              DateTime.fromISO(item["Warranty Start Date"]),
              ["Warranty Started", item["Serial Number"]],
            ],
    },
    {
      glob: new Minimatch("iCloud Drive/**/UbiquitousCards/**/pass.json"),
      tokenize: (data) => [parseJSON(data)],
      parse: (item) => [
        "icloud",
        DateTime.fromISO(item.relevantDate, {
          zone: "UTC",
        }),
        ["Wallet Pass", item.description],
      ],
    },
    {
      glob: new Minimatch(
        "**/Device Registration History Pre iOS8 and Yosemite.csv"
      ),
      parse: (item) => [
        "activity",
        DateTime.fromSQL(item["Registration_Timestamp"], {
          zone: "UTC",
        }),
        ["Registered Device (Marketing)", item["Serial_Nr"]],
      ],
    },
    {
      glob: new Minimatch("**/Marketing Communications Delivery.csv"),
      tokenize: async (data) => (await parseCSV(data)).slice(1),
      parse: (item) => [
        "activity",
        DateTime.fromSQL(item["Delivery Time"].slice(0, -1), {
          zone: "UTC",
        }),
        ["Received Marketing Email", item["Communication Name"].slice(1)],
      ],
    },
    {
      glob: new Minimatch("**/Marketing Communications Response.csv"),
      parse: (item) => {
        let action = item["Response Type"];
        action = action[0].toUpperCase() + action.slice(1);
        return [
          "activity",
          DateTime.fromSQL(item["Response Time"], {
            zone: "UTC",
          }),
          [`Marketing Email ${action}`, item["Communication Name"]],
        ];
      },
    },
    {
      glob: new Minimatch("**/Apple Features Using iCloud/Mail/Recents.xml"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tokenize: (data) => plist.parse(smartDecode(data)) as any,
      parse: (item) => {
        if (item.MAX_RECENTS) return;
        const values = Object.values(item) as {
          t: Date[];
          "display name"?: string;
          address: string;
          "group members"?: {
            "display name"?: string;
            address: string;
          }[];
        }[];
        return values.flatMap((value) => {
          return value.t.map((time) => {
            const recipients = value["group members"] || [value];
            const address = recipients
              .map((r) =>
                r["display name"]
                  ? `${r["display name"]} <${r["address"]}>`
                  : r["address"]
              )
              .join(", ");
            return [
              "icloud",
              DateTime.fromJSDate(time),
              ["Mail Message", address],
            ] as TimelineTuple<CategoryKey>;
          });
        });
      },
    },
    {
      glob: new Minimatch(
        "**/Apple Features Using iCloud/Wi-Fi/KnownNetworks.xml"
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tokenize: (data) => plist.parse(smartDecode(data)) as any,
      parse: (item) => {
        const values = Object.values(item) as {
          added_at: string;
          SSID_STR: string;
        }[];
        return values.flatMap((value) => {
          return [
            "icloud",
            DateTime.fromFormat(value.added_at, "LLL dd yyyy HH:mm:ss", {
              zone: "UTC",
            }),
            ["Added  Wi-Fi Network", value.SSID_STR],
          ];
        }) as TimelineTuple<CategoryKey>;
      },
    },
    {
      glob: new Minimatch("**/iCloudUsageData Set*.csv"),
      tokenize: async (data) => {
        const lines = smartDecode(data).split("\n");
        const groups = new Map();
        let buffer = [];
        let header = "";
        for (const line of lines) {
          if (line.startsWith('"')) {
            buffer.push(line);
          } else {
            if (header) groups.set(header, buffer);
            buffer = [];
            header = line;
          }
        }
        if (header) groups.set(header, buffer);

        const registration = groups.get(
          "iCloud: Device registration from an iCloud enabled device"
        );
        return registration ? await parseCSV(registration.join("\n")) : [];
      },
      parse: (item) => [
        "icloud",
        DateTime.fromSQL(item["Date"]),
        [
          `Device ${item["Event Code"] === "reboot" ? "Reboot" : "Sync"}`,
          item["Device Type"],
        ],
      ],
    },
    {
      glob: new Minimatch("**/Apple Pay Cards.csv"),
      parse: (item) => [
        "account",
        DateTime.fromSQL(item[" Date Created"], {
          zone: "UTC",
        }),
        ["Enrolled Apple Pay Card", item[" Card Name"]],
      ],
    },
  ];
}

export default Apple;
