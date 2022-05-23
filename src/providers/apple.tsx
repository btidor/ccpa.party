import { DateTime } from "luxon";

import type {
  DataFile,
  TimelineContext,
  TimelineEntry,
} from "@src/common/database";
import {
  getSlugAndDayTime,
  parseCSV,
  parseJSON,
  smartDecode,
} from "@src/common/parse";
import type { Provider, TimelineCategory } from "@src/common/provider";

type CategoryKey = "account" | "activity" | "icloud" | "media";

class Apple implements Provider<CategoryKey> {
  slug: string = "apple";
  displayName: string = "Apple";

  brandColor: string = "#ffb900";
  neonColor: string = "#e08800";
  neonColorHDR: string = "color(rec2020 0.75646 0.54656 -0.09204)";

  requestLink: { href: string; text: string } = {
    text: "Data and Privacy",
    href: "https://privacy.apple.com/",
  };
  waitTime: string = "about a week";
  instructions: ReadonlyArray<string> = [];
  singleFile: boolean = false;
  fileName: string = "zip files";
  privacyPolicy: string = "https://www.apple.com/legal/privacy/california/";

  timelineCategories: ReadonlyMap<CategoryKey, TimelineCategory> = new Map([
    [
      "account",
      {
        char: "c",
        icon: "🪪",
        displayName: "Account",
        defaultEnabled: true,
      },
    ],
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
      "icloud",
      {
        char: "i",
        icon: "🌥",
        displayName: "iCloud",
        defaultEnabled: true,
      },
    ],
    [
      "media",
      {
        char: "m",
        icon: "🎶",
        displayName: "Media",
        defaultEnabled: true,
      },
    ],
  ]);

  async parse(
    file: DataFile
  ): Promise<ReadonlyArray<TimelineEntry<CategoryKey>>> {
    const entry = (
      row: any,
      category: CategoryKey,
      datetime: any,
      context: TimelineContext
    ) => ({
      file: file.path,
      category,
      ...getSlugAndDayTime(datetime.toSeconds(), row),
      context,
      value: row,
    });

    if (file.path[1] === "Apple ID account and device information") {
      if (file.path[2] === "Apple ID Account Information.csv") {
        return (await parseCSV(file.data)).map((row) =>
          entry(
            row,
            "account",
            DateTime.fromSQL(row["Last Update Date"], {
              zone: "UTC",
            }),
            ["Updated Apple ID account information"]
          )
        );
      } else if (file.path[2] === "Apple ID Device Information.csv") {
        return (await parseCSV(file.data)).flatMap((row) => [
          entry(
            row,
            "account",
            DateTime.fromSQL(row["Device Added Date"], {
              zone: "UTC",
            }),
            ["Added Device", row["Device Name"]]
          ),
          entry(
            row,
            "account",
            DateTime.fromSQL(row["Device Last Heartbeat Timestamp"], {
              zone: "UTC",
            }),
            [
              "Device Last Heartbeat",
              `${row["Device Name"]} at ${row["Device Last Heartbeat IP"]}`,
            ]
          ),
        ]);
      } else if (file.path[2] === "Apple ID SignOn Information.csv") {
        return (await parseCSV(file.data)).map((row) =>
          entry(
            row,
            "account",
            DateTime.fromSQL(row["Logged In Date"], {
              zone: "UTC",
            }),
            [
              "Latest Sign-on",
              row["Application"] +
                (row["IP Address"] !== "N/A"
                  ? ` from ${row["IP Address"]}`
                  : ""),
            ]
          )
        );
      } else if (file.path[2] === "Data & Privacy Request History.csv") {
        return (await parseCSV(file.data)).map((row) =>
          entry(
            row,
            "account",
            DateTime.fromSQL(row["Request Time"], {
              zone: "UTC",
            }),
            ["Submitted Data & Privacy Request"]
          )
        );
      }
    } else if (file.path[1] === "Apple Media Services information") {
      if (file.path.slice(-1)[0] === "Apple Music Likes and Dislikes.csv") {
        return (await parseCSV(file.data)).map((row) =>
          entry(row, "media", DateTime.fromISO(row["Created"]), [
            (row["Preference"] === "LOVE"
              ? "Loved"
              : row["Preference"] === "DISLIKE"
              ? "Disliked"
              : "Marked") + " Track",
            row["Item Description"],
          ])
        );
      } else if (file.path.slice(-1)[0] === "Apple Music Play Activity.csv") {
        return (await parseCSV(file.data))
          .map(
            (row) =>
              row["Song Name"] &&
              entry(
                row,
                "media",
                DateTime.fromISO(
                  row["Event Start Timestamp"] || row["Event End Timestamp"]
                ),
                [
                  row["Event Type"] === "PLAY_END"
                    ? "Played Track"
                    : row["Event Type"] === "LYRIC_DISPLAY"
                    ? "Viewed Lyrics"
                    : "Media Event",
                  row["Song Name"],
                ]
              )
          )
          .filter((x): x is TimelineEntry<CategoryKey> => !!x);
      } else if (
        file.path.slice(-1)[0] ===
        "Customer Device History - Computer Authorizations.csv"
      ) {
        return (await parseCSV(file.data)).map((row) =>
          entry(row, "account", DateTime.fromISO(row["Associated Date"]), [
            "Authorized iTunes",
            row["Device Name"],
          ])
        );
      } else if (
        file.path.slice(-1)[0] ===
        "In-App Subscription Family Sharing History.csv"
      ) {
        return (await parseCSV(file.data)).map((row) =>
          entry(row, "account", DateTime.fromISO(row["Last Modified Date"]), [
            row["Family Sharing Enabled"] === "Yes"
              ? "Shared App with Family"
              : "Un-shared App with Family",
            row["App Name"],
          ])
        );
      } else if (
        file.path.slice(-1)[0] === "Store Free Transaction History.csv"
      ) {
        return (await parseCSV(file.data)).map((row) =>
          entry(row, "account", DateTime.fromISO(row["Item Purchased Date"]), [
            "Purchased App",
            row["Item Description"],
          ])
        );
      } else if (file.path.slice(-1)[0] === "Store Transaction History.csv") {
        return (await parseCSV(file.data)).map((row) =>
          entry(row, "account", DateTime.fromISO(row["Item Purchased Date"]), [
            `Purchased ${
              row["Content Type"].includes("Apps")
                ? "App"
                : row["Content Type"].endsWith("s")
                ? row["Content Type"].slice(0, -1)
                : row["Content Type"]
            }`,
            row["Item Description"],
          ])
        );
      } else if (
        file.path.slice(-1)[0] === "TV App Favorites and Activity.json"
      ) {
        return (await parseJSON(file.data)).events.map((item: any) =>
          entry(
            item,
            "media",
            DateTime.fromMillis(item.stored_event.timestamp),
            [
              "Watched Media",
              item.event_interpretation.human_readable_media_description,
            ]
          )
        );
      } else if (
        file.path.slice(-1)[0] === "App Store Click Activity.csv" ||
        file.path.slice(-1)[0] === "Apple Music Click Activity.csv" ||
        file.path.slice(-1)[0] === "Apps And Service Analytics.csv" ||
        file.path.slice(-1)[0] ===
          "TV App with Channel Support Click Activity.csv"
      ) {
        return (await parseCSV(file.data)).map((row) => {
          let type = row["Event Type"];
          type = type[0].toUpperCase() + type.slice(1);
          return entry(
            row,
            "activity",
            DateTime.fromISO(row["Event Date Time"]),
            [
              `${type} Event`,
              row["App"] || row["App Name"] || row["Media Bundle App Name"],
            ]
          );
        });
      } else if (
        file.path.slice(-1)[0] === "Limit Ad Tracking Information.csv"
      ) {
        return (await parseCSV(file.data)).map((row) =>
          entry(row, "account", DateTime.fromISO(row["Created Date"]), [
            "Limited Ad Tracking",
          ])
        );
      } else if (file.path[2] === "Direct Top-Up Promotions.csv") {
        return (await parseCSV(file.data)).map((row) =>
          entry(row, "account", DateTime.fromSQL(row["Promotion Start Date"]), [
            "Offered Promotion",
            row["Promotion Details"],
          ])
        );
      } else if (file.path[4] === "Game Center Data.json") {
        const games = (await parseJSON(file.data)).games_state;
        return games
          .map((game: any) => [
            game.leaderboard.map((board: any) =>
              board.leaderboard_score.map((item: any) =>
                entry(
                  item,
                  "icloud",
                  DateTime.fromFormat(
                    item.submitted_time_utc,
                    "MM/dd/yyyy HH:mm:ss"
                  ),
                  [
                    "Game Center Leaderboard",
                    `${board.leaderboard_title} in ${game.game_name}`,
                  ]
                )
              )
            ),
            game.achievements.map((item: any) =>
              entry(
                item,
                "icloud",
                DateTime.fromFormat(
                  item.last_update_utc,
                  "MM/dd/yyyy HH:mm:ss"
                ),
                [
                  "Game Center Achievement",
                  `${item.achievements_title} in ${game.game_name}`,
                ]
              )
            ),
          ])
          .flat(3);
      } else if (
        file.path[3] ===
        "iTunes and App-Book Re-download and Update History.csv"
      ) {
        return (await parseCSV(file.data)).map((row) =>
          entry(
            row,
            "activity",
            DateTime.fromISO(row["Activity Date"], { zone: "UTC" }),
            ["Updated App", row["Item Description"]]
          )
        );
      }
    } else if (file.path[1] === "Apple Online and Retail Stores") {
      if (file.path[3] === "Online Purchase History.csv") {
        return (await parseCSV(file.data))
          .slice(1) // strip duplciated header
          .map((row) =>
            entry(
              row,
              "account",
              DateTime.fromISO(row["Order Date"], {
                zone: "UTC",
              }),
              ["Placed Online Order", row["Description"]]
            )
          );
      }
    } else if (file.path[1] === "AppleCare") {
      if (file.path[4] === "AppleCare Partners Repairs and Service.csv") {
        // Strip out header and footer
        const stripped = smartDecode(file.data)
          .split("\n")
          .slice(4, -1)
          .join("\n");
        return (await parseCSV(stripped)).map((row) =>
          entry(
            row,
            "account",
            DateTime.fromISO(row["TimeStamp"], {
              zone: "UTC",
            }),
            ["AppleCare Repair", row["Serial Number"]]
          )
        );
      } else if (file.path[4] === "AppleCare Repairs and Service.csv") {
        // Strip out footer
        const stripped = smartDecode(file.data)
          .split("\n")
          .slice(0, -1)
          .join("\n");
        return (await parseCSV(stripped)).map((row) =>
          entry(
            row,
            "account",
            DateTime.fromISO(row["Repair Created Date"], {
              zone: "UTC",
            }),
            ["AppleCare Repair", row["Serial Number"]]
          )
        );
      } else if (file.path[4] === "AppleCare Cases.csv") {
        // Strip out footer
        const stripped = smartDecode(file.data)
          .split("\n")
          .slice(0, -3)
          .join("\n");
        return (await parseCSV(stripped)).map((row) =>
          entry(row, "account", DateTime.fromISO(row["Creation Date"]), [
            "Created AppleCare Case",
            row["Case Title"],
          ])
        );
      } else if (file.path[4] === "AppleCare Device Details.csv") {
        const parts = smartDecode(file.data).split(/\n\n+/);
        return [
          ...(await parseCSV(parts[0])).map((row) =>
            entry(row, "account", DateTime.fromISO(row["Purchase Date"]), [
              "Purchased Device",
              row["Product Description"],
            ])
          ),
          ...(await parseCSV(parts[1])).map((row) =>
            entry(
              row,
              "account",
              DateTime.fromISO(row["Warranty Start Date"]),
              ["Warranty Started", row["Serial Number"]]
            )
          ),
        ];
      }
    } else if (file.path[1] === "iCloud Drive") {
      if (file.path[4] === "UbiquitousCards" && file.path[6] === "pass.json") {
        const parsed = parseJSON(file.data);
        return [
          entry(
            parsed,
            "icloud",
            DateTime.fromISO(parsed.relevantDate, {
              zone: "UTC",
            }),
            ["Wallet Pass", parsed.description]
          ),
        ];
      }
    } else if (file.path[1] === "Marketing communications") {
      if (
        file.path[2] === "Device Registration History Pre iOS8 and Yosemite.csv"
      ) {
        return (await parseCSV(file.data)).map((row) =>
          entry(
            row,
            "activity",
            DateTime.fromSQL(row["Registration_Timestamp"], {
              zone: "UTC",
            }),
            ["Registered Device (Marketing)", row["Serial_Nr"]]
          )
        );
      } else if (file.path[2] === "Marketing Communications Delivery.csv") {
        return (await parseCSV(file.data))
          .slice(1) // strip duplciated header
          .map((row) =>
            entry(
              row,
              "activity",
              DateTime.fromSQL(row["Delivery Time"].slice(0, -1), {
                zone: "UTC",
              }),
              ["Received Marketing Email", row["Communication Name"].slice(1)]
            )
          );
      } else if (file.path[2] === "Marketing Communications Response.csv") {
        return (await parseCSV(file.data)).map((row) => {
          let action = row["Response Type"];
          action = action[0].toUpperCase() + action.slice(1);
          return entry(
            row,
            "activity",
            DateTime.fromSQL(row["Response Time"], {
              zone: "UTC",
            }),
            [`Marketing Email ${action}`, row["Communication Name"]]
          );
        });
      }
    } else if (file.path[1] === "Other data") {
      if (file.path[3] === "Apple Features Using iCloud") {
        if (file.path[4] === "Mail" && file.path[5] === "Recents.xml") {
          const dom = new DOMParser().parseFromString(
            smartDecode(file.data),
            "text/xml"
          );
          const entries = dom.getElementsByTagName("dict");
          const messages = Array.from(entries).filter((d) =>
            Array.from(d.children).some(
              (c) => c.nodeName === "key" && c.innerHTML === "t"
            )
          );
          return messages.flatMap((msg) => {
            const dates =
              Array.from(msg.children)
                .find((c) => c.nodeName === "key" && c.innerHTML === "t")
                ?.nextElementSibling?.getElementsByTagName("date") || [];
            const address = Array.from(msg.children).find(
              (c) => c.nodeName === "key" && c.innerHTML === "address"
            )?.nextElementSibling?.innerHTML;
            return Array.from(dates).map((date) =>
              entry(msg.innerHTML, "icloud", DateTime.fromISO(date.innerHTML), [
                "Mail Message",
                address,
              ])
            );
          });
        } else if (
          file.path[4] === "Wi-Fi" &&
          file.path[5] === "KnownNetworks.xml"
        ) {
          const dom = new DOMParser().parseFromString(
            smartDecode(file.data),
            "text/xml"
          );
          const root = dom.getElementsByTagName("array")[0];
          return Array.from(root.children).map((item) => {
            const keys = item.getElementsByTagName("key");
            const name = keys[0]?.innerHTML;
            const added = Array.from(keys).find(
              (k) => k.innerHTML === "added_at"
            )?.nextElementSibling?.innerHTML!;
            return entry(
              item.innerHTML,
              "icloud",
              DateTime.fromFormat(added, "LLL dd yyyy HH:mm:ss", {
                zone: "UTC",
              }),
              ["Added  Wi-Fi Network", name]
            );
          });
        }
      } else if (file.path[3] === "iCloudUsageData Set1.csv") {
        const lines = smartDecode(file.data).split("\n");
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
        if (registration) {
          return (await parseCSV(registration.join("\n"))).map((row) =>
            entry(row, "icloud", DateTime.fromSQL(row["Date"]), [
              `Device ${row["Event Code"] === "reboot" ? "Reboot" : "Sync"}`,
              row["Device Type"],
            ])
          );
        }
      }
    } else if (file.path[1] === "Wallet Activity") {
      if (file.path[2] === "Apple Pay Cards.csv") {
        return (await parseCSV(file.data)).map((row) =>
          entry(
            row,
            "account",
            DateTime.fromSQL(row[" Date Created"], {
              zone: "UTC",
            }),
            ["Enrolled Apple Pay Card", row[" Card Name"]]
          )
        );
      }
    }
    return [];
  }
}

export default Apple;
