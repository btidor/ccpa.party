// @flow
import { DateTime } from "luxon";
import * as React from "react";

import {
  getSlugAndDay,
  parseJSON,
  parseCSV,
  smartDecode,
} from "common/importer";

import type { DataFile, Entry, TimelineEntry } from "common/database";
import type { Provider, TimelineCategory } from "common/provider";

class Apple implements Provider {
  slug: string = "apple";
  displayName: string = "Apple";
  color: string = "#000000";
  darkColor: string = "#ffb900";

  requestLink: {| href: string, text: string |} = {
    text: "Data and Privacy",
    href: "https://privacy.apple.com/",
  };
  waitTime: string = "about a week";
  instructions: $ReadOnlyArray<string> = [];
  privacyPolicy: string = "https://www.apple.com/legal/privacy/california/";

  timelineCategories: $ReadOnlyArray<TimelineCategory> = [
    {
      char: "s",
      slug: "store",
      displayName: "App Store",
      defaultEnabled: false,
    },
    {
      char: "i",
      slug: "appleId",
      displayName: "Apple ID",
      defaultEnabled: true,
    },
    {
      char: "c",
      slug: "applecare",
      displayName: "AppleCare",
      defaultEnabled: true,
    },
    {
      char: "m",
      slug: "marketing",
      displayName: "Marketing",
      defaultEnabled: true,
    },
    {
      char: "r",
      slug: "retail",
      displayName: "Retail",
      defaultEnabled: true,
    },
    {
      char: "w",
      slug: "wallet",
      displayName: "Wallet",
      defaultEnabled: true,
    },
  ];

  async parse(file: DataFile): Promise<$ReadOnlyArray<Entry>> {
    if (file.skipped) return [];
    if (file.path[1] === "Apple ID account and device information") {
      if (file.path[2] === "Apple ID Account Information.csv") {
        return (await parseCSV(file.data)).map(
          (row) =>
            ({
              type: "timeline",
              provider: file.provider,
              file: file.path,
              category: "appleId",
              ...getSlugAndDay(
                DateTime.fromSQL(row["Last Update Date"], {
                  zone: "UTC",
                }).toSeconds(),
                row
              ),
              context: "id.account.updated",
              value: row,
            }: TimelineEntry)
        );
      } else if (file.path[2] === "Apple ID Device Information.csv") {
        return (await parseCSV(file.data)).flatMap((row) => [
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "appleId",
            ...getSlugAndDay(
              DateTime.fromSQL(row["Device Added Date"], {
                zone: "UTC",
              }).toSeconds(),
              row
            ),
            context: "id.device.added",
            value: row,
          }: TimelineEntry),
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "appleId",
            ...getSlugAndDay(
              DateTime.fromSQL(row["Device Last Heartbeat Timestamp"], {
                zone: "UTC",
              }).toSeconds(),
              row
            ),
            context: "id.device.lastHeartbeat",
            value: row,
          }: TimelineEntry),
        ]);
      } else if (file.path[2] === "Apple ID SignOn Information.csv") {
        return (await parseCSV(file.data)).map(
          (row) =>
            ({
              type: "timeline",
              provider: file.provider,
              file: file.path,
              category: "appleId",
              ...getSlugAndDay(
                DateTime.fromSQL(row["Logged In Date"], {
                  zone: "UTC",
                }).toSeconds(),
                row
              ),
              context: "id.signon",
              value: row,
            }: TimelineEntry)
        );
      } else if (file.path[2] === "Data & Privacy Request History.csv") {
        return (await parseCSV(file.data)).map(
          (row) =>
            ({
              type: "timeline",
              provider: file.provider,
              file: file.path,
              category: "appleId",
              ...getSlugAndDay(
                DateTime.fromSQL(row["Request Time"], {
                  zone: "UTC",
                }).toSeconds(),
                row
              ),
              context: "id.privacy",
              value: row,
            }: TimelineEntry)
        );
      }
    } else if (file.path[1] === "Apple Media Services information") {
      if (file.path[2] === "Direct Top-Up Promotions.csv") {
        return (await parseCSV(file.data)).map(
          (row) =>
            ({
              type: "timeline",
              provider: file.provider,
              file: file.path,
              category: "store",
              ...getSlugAndDay(
                DateTime.fromSQL(row["Promotion Start Date"], {
                  zone: "UTC",
                }).toSeconds(),
                row
              ),
              context: "media.promotion",
              value: row,
            }: TimelineEntry)
        );
      } else if (
        file.path[3] ===
        "iTunes and App-Book Re-download and Update History.csv"
      ) {
        return (await parseCSV(file.data)).map(
          (row) =>
            ({
              type: "timeline",
              provider: file.provider,
              file: file.path,
              category: "store",
              ...getSlugAndDay(
                DateTime.fromISO(row["Activity Date"], {
                  zone: "UTC",
                }).toSeconds(),
                row
              ),
              context: "media.download",
              value: row,
            }: TimelineEntry)
        );
      }
    } else if (file.path[1] === "Apple Online and Retail Stores") {
      if (file.path[3] === "Online Purchase History.csv") {
        return (await parseCSV(file.data))
          .slice(1) // strip duplciated header
          .map(
            (row) =>
              ({
                type: "timeline",
                provider: file.provider,
                file: file.path,
                category: "retail",
                ...getSlugAndDay(
                  DateTime.fromISO(row["Order Date"], {
                    zone: "UTC",
                  }).toSeconds(),
                  row
                ),
                context: "retail.purchase",
                value: row,
              }: TimelineEntry)
          );
      }
    } else if (file.path[1] === "AppleCare") {
      if (file.path[4] === "AppleCare Partners Repairs and Service.csv") {
        // Strip out header and footer
        const stripped = smartDecode(file.data)
          .split("\n")
          .slice(4, -1)
          .join("\n");
        return (await parseCSV(stripped)).map(
          (row) =>
            ({
              type: "timeline",
              provider: file.provider,
              file: file.path,
              category: "applecare",
              ...getSlugAndDay(
                DateTime.fromISO(row["TimeStamp"], {
                  zone: "UTC",
                }).toSeconds(),
                row
              ),
              context: "care.repair",
              value: row,
            }: TimelineEntry)
        );
      } else if (file.path[4] === "AppleCare Repairs and Service.csv") {
        // Strip out footer
        const stripped = smartDecode(file.data)
          .split("\n")
          .slice(0, -1)
          .join("\n");
        return (await parseCSV(stripped)).map(
          (row) =>
            ({
              type: "timeline",
              provider: file.provider,
              file: file.path,
              category: "applecare",
              ...getSlugAndDay(
                DateTime.fromISO(row["Repair Created Date"], {
                  zone: "UTC",
                }).toSeconds(),
                row
              ),
              context: "care.repair",
              value: row,
            }: TimelineEntry)
        );
      } else if (file.path[4] === "AppleCare Cases.csv") {
        // Strip out footer
        const stripped = smartDecode(file.data)
          .split("\n")
          .slice(0, -3)
          .join("\n");
        return (await parseCSV(stripped)).map(
          (row) =>
            ({
              type: "timeline",
              provider: file.provider,
              file: file.path,
              category: "applecare",
              ...getSlugAndDay(
                DateTime.fromISO(row["Creation Date"]).toSeconds(),
                row
              ),
              context: "care.case",
              value: row,
            }: TimelineEntry)
        );
      } else if (file.path[4] === "AppleCare Device Details.csv") {
        const parts = smartDecode(file.data).split(/\n\n+/);
        return [
          ...(await parseCSV(parts[0])).map(
            (row) =>
              ({
                type: "timeline",
                provider: file.provider,
                file: file.path,
                category: "applecare",
                ...getSlugAndDay(
                  DateTime.fromISO(row["Purchase Date"]).toSeconds(),
                  row
                ),
                context: "care.device",
                value: row,
              }: TimelineEntry)
          ),
          ...(await parseCSV(parts[1])).map(
            (row) =>
              ({
                type: "timeline",
                provider: file.provider,
                file: file.path,
                category: "applecare",
                ...getSlugAndDay(
                  DateTime.fromISO(row["Warranty Start Date"]).toSeconds(),
                  row
                ),
                context: "care.warranty",
                value: row,
              }: TimelineEntry)
          ),
          ...(await parseCSV(parts[2])).map(
            (row) =>
              ({
                type: "timeline",
                provider: file.provider,
                file: file.path,
                category: "applecare",
                ...getSlugAndDay(
                  DateTime.fromISO(row["Agreement Start Date"]).toSeconds(),
                  row
                ),
                context: "care.agreement",
                value: row,
              }: TimelineEntry)
          ),
        ];
      }
    } else if (file.path[1] === "Marketing communications") {
      if (
        file.path[2] === "Device Registration History Pre iOS8 and Yosemite.csv"
      ) {
        return (await parseCSV(file.data)).map(
          (row) =>
            ({
              type: "timeline",
              provider: file.provider,
              file: file.path,
              category: "marketing",
              ...getSlugAndDay(
                DateTime.fromSQL(row["Registration_Timestamp"], {
                  zone: "UTC",
                }).toSeconds(),
                row
              ),
              context: "marketing.device",
              value: row,
            }: TimelineEntry)
        );
      } else if (file.path[2] === "Marketing Communications Delivery.csv") {
        return (await parseCSV(file.data))
          .slice(1) // strip duplciated header
          .map(
            (row) =>
              ({
                type: "timeline",
                provider: file.provider,
                file: file.path,
                category: "marketing",
                ...getSlugAndDay(
                  DateTime.fromSQL(row["Delivery Time"].slice(0, -1), {
                    zone: "UTC",
                  }).toSeconds(),
                  row
                ),
                context: "marketing.communication",
                value: row,
              }: TimelineEntry)
          );
      } else if (file.path[2] === "Marketing Communications Response.csv") {
        return (await parseCSV(file.data)).map(
          (row) =>
            ({
              type: "timeline",
              provider: file.provider,
              file: file.path,
              category: "marketing",
              ...getSlugAndDay(
                DateTime.fromSQL(row["Response Time"], {
                  zone: "UTC",
                }).toSeconds(),
                row
              ),
              context: "marketing.response",
              value: row,
            }: TimelineEntry)
        );
      }
    } else if (file.path[1] === "Wallet Activity") {
      if (file.path[2] === "Apple Pay Cards.csv") {
        return (await parseCSV(file.data)).map(
          (row) =>
            ({
              type: "timeline",
              provider: file.provider,
              file: file.path,
              category: "wallet",
              ...getSlugAndDay(
                DateTime.fromSQL(row[" Date Created"], {
                  zone: "UTC",
                }).toSeconds(),
                row
              ),
              context: "wallet.card",
              value: row,
            }: TimelineEntry)
        );
      }
    } else if (file.path[1] === "iCloud Drive") {
      if (file.path[4] === "UbiquitousCards" && file.path[6] === "pass.json") {
        const parsed = parseJSON(file.data);
        return [
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "wallet",
            ...getSlugAndDay(
              DateTime.fromISO(parsed.relevantDate, {
                zone: "UTC",
              }).toSeconds(),
              parsed
            ),
            context: "wallet.pass",
            value: parsed,
          }: TimelineEntry),
        ];
      }
    }
    return [];
  }

  render(entry: TimelineEntry): React.Node {
    if (entry.context === "id.account.updated") {
      return (
        <React.Fragment>Updated Apple ID account information</React.Fragment>
      );
    } else if (entry.context === "id.device.added") {
      return (
        <React.Fragment>
          Added device <i>{entry.value["Device Name"]}</i>
        </React.Fragment>
      );
    } else if (entry.context === "id.device.lastHeartbeat") {
      return (
        <React.Fragment>
          Heartbeat from device <i>{entry.value["Device Name"]}</i> at{" "}
          <i>{entry.value["Device Last Heartbeat IP"]}</i>
        </React.Fragment>
      );
    } else if (entry.context === "id.signon") {
      return (
        <React.Fragment>
          Logged in to <i>{entry.value["Application"]}</i>{" "}
          {entry.value["IP Address"] !== "N/A" && (
            <React.Fragment>
              from <i>{entry.value["IP Address"]}</i>
            </React.Fragment>
          )}
        </React.Fragment>
      );
    } else if (entry.context === "id.privacy") {
      return (
        <React.Fragment>Submitted Data &amp; Privacy request</React.Fragment>
      );
    } else if (entry.context === "media.promotion") {
      return (
        <React.Fragment>Offered Apple Media Services promotion</React.Fragment>
      );
    } else if (entry.context === "media.download") {
      return (
        <React.Fragment>
          Downloaded or updated app <i>{entry.value["Item Description"]}</i>
        </React.Fragment>
      );
    } else if (entry.context === "retail.purchase") {
      return (
        <React.Fragment>
          Purchased <i>{entry.value["Description"]}</i>
        </React.Fragment>
      );
    } else if (entry.context === "care.repair") {
      return (
        <React.Fragment>
          AppleCare repair for <i>{entry.value["Serial Number"]}</i>{" "}
          {entry.value["Description"] && <i>({entry.value["Description"]})</i>}
        </React.Fragment>
      );
    } else if (entry.context === "care.case") {
      return (
        <React.Fragment>
          Created AppleCare case for <i>{entry.value["Serial Number"]}</i>:{" "}
          {entry.value["Case Title"]}
        </React.Fragment>
      );
    } else if (entry.context === "care.device") {
      return (
        <React.Fragment>
          Purchased device <i>{entry.value["Serial Number"]}</i> (
          {entry.value["Product Description"]})
        </React.Fragment>
      );
    } else if (entry.context === "care.warranty") {
      return (
        <React.Fragment>
          Warranty started for <i>{entry.value["Serial Number"]}</i>
        </React.Fragment>
      );
    } else if (entry.context === "care.agreement") {
      return (
        <React.Fragment>
          AppleCare agreement started for <i>{entry.value["Serial Number"]}</i>
        </React.Fragment>
      );
    } else if (entry.context === "marketing.device") {
      return (
        <React.Fragment>
          Registered device <i>{entry.value["Serial_Nr"]}</i>
        </React.Fragment>
      );
    } else if (entry.context === "marketing.communication") {
      return (
        <React.Fragment>
          Marketing email: <i>{entry.value["Communication Name"].slice(1)}</i>
        </React.Fragment>
      );
    } else if (entry.context === "marketing.response") {
      return (
        <React.Fragment>
          Marketing email {entry.value["Response Type"]}:{" "}
          <i>{entry.value["Communication Name"]}</i>
        </React.Fragment>
      );
    } else if (entry.context === "wallet.card") {
      return (
        <React.Fragment>
          Added Apple Pay card <i>{entry.value[" Card Name"]}</i> to{" "}
          {entry.value[" Device Type"]}
        </React.Fragment>
      );
    } else if (entry.context === "wallet.pass") {
      return (
        <React.Fragment>
          Wallet Pass: <i>{entry.value.description}</i>
        </React.Fragment>
      );
    }
    return <React.Fragment>Unknown</React.Fragment>;
  }
}

export default Apple;
