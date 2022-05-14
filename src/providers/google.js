// @flow
import { DateTime } from "luxon";
import * as React from "react";

import { getSlugAndDayTime, parseCSV, parseJSON } from "common/parse";

import styles from "providers/google.module.css";

import type { DataFile, Entry, TimelineEntry } from "common/database";
import type { Provider, TimelineCategory } from "common/provider";

class Google implements Provider {
  slug: string = "google";
  displayName: string = "Google";
  color: string = "#34a853";

  requestLink: {| href: string, text: string |} = {
    text: "Google Takeout",
    href: "https://takeout.google.com/",
  };
  waitTime: string = "a day or two";
  instructions: $ReadOnlyArray<string> = [
    `for every row:`,
    ` check the box &`,
    ` click "Multiple Formats"`,
    ` - change to JSON (or CSV)`,
  ];
  singleFile: boolean = true;
  privacyPolicy: string =
    "https://policies.google.com/privacy?hl=en#california";

  timelineCategories: $ReadOnlyArray<TimelineCategory> = [
    {
      char: "a",
      slug: "activity",
      displayName: "Activity",
      defaultEnabled: true,
    },
    {
      char: "s",
      slug: "security",
      displayName: "Security Logs",
      defaultEnabled: false,
    },
  ];

  async parse(file: DataFile): Promise<$ReadOnlyArray<Entry>> {
    const entry = (
      row: any,
      category: string,
      datetime: any,
      context: any
    ) => ({
      type: "timeline",
      provider: file.provider,
      file: file.path,
      category,
      ...getSlugAndDayTime(datetime.toSeconds(), row),
      context,
      value: row,
    });

    if (file.path[2] === "Access Log Activity") {
      if (file.path[3].startsWith("Activities - ")) {
        return (await parseCSV(file.data)).map((row) =>
          entry(row, "security", DateTime.fromSQL(row["Activity Timestamp"]), [
            "🪪",
            row["Product Name"] === "Other"
              ? "Activity"
              : `Accessed ${row["Product Name"]}`,
            `from ${row["IP Address"]}`,
          ])
        );
      }
    } else if (file.path[2] === "My Activity") {
      return (await parseJSON(file.data)).map((row) => {
        let { title, header } = row;
        if (row.details?.some((x) => x.name === "From Google Ads"))
          header = "Google Ads";
        if (
          header === "Maps" &&
          row.titleUrl?.startsWith("https://www.google.com/maps/place/")
        )
          title = `Viewed ${title}`;
        return entry(row, "activity", DateTime.fromISO(row.time), [
          "🖱",
          title,
          header,
        ]);
      });
    } else if (file.path[2] === "Drive") {
      if (file.path.slice(-1)[0].endsWith("-info.json")) {
        const parsed = await parseJSON(file.data);
        if (parsed.last_modified_by_me) {
          return [
            entry(
              parsed,
              "activity",
              DateTime.fromISO(parsed.last_modified_by_me),
              ["🖱", `Edited "${parsed.title}"`, "Google Drive"]
            ),
          ];
        }
      }
    }
    return [];
  }

  render(entry: TimelineEntry, time: ?string): React.Node {
    const [icon, major, minor] = entry.context;
    return (
      <div className={styles.line}>
        <span className={styles.time}>{time}</span>
        <span className={styles.icon}>{icon}</span>
        <span className={styles.text}>
          <span className={styles.major}>{major}</span>
          <span className={styles.minor}>{minor}</span>
        </span>
      </div>
    );
  }
}

export default Google;
