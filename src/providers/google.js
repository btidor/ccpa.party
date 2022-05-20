// @flow
import { DateTime } from "luxon";

import { getSlugAndDayTime, parseCSV, parseJSON } from "common/parse";

import type { DataFile, TimelineContext, TimelineEntry } from "common/database";
import type { Provider, TimelineCategory } from "common/provider";

type CategoryKey = "activity" | "security";

class Google implements Provider<CategoryKey> {
  slug: string = "google";
  displayName: string = "Google";

  brandColor: string = "#34a853";
  neonColor: string = "#00c300";
  neonColorHDR: string = "color(rec2020 0.1856 0.71527 0.06415)";

  requestLink: {| href: string, text: string |} = {
    text: "Google Takeout",
    href: "https://takeout.google.com/",
  };
  waitTime: string = "1-2 days";
  instructions: $ReadOnlyArray<string> = [
    `check Access Log Activity`,
    ``,
    `under My Activity`,
    ` click Multiple Formats`,
    `  change HTML to JSON`,
  ];
  singleFile: boolean = true;
  fileName: string = "takeout.zip";
  privacyPolicy: string =
    "https://policies.google.com/privacy?hl=en#california";

  metadataFiles: $ReadOnlyArray<string | RegExp> = [];

  timelineCategories: $ReadOnlyMap<CategoryKey, TimelineCategory> = new Map([
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
      "security",
      {
        char: "s",
        icon: "🪪",
        displayName: "Security Logs",
        defaultEnabled: false,
      },
    ],
  ]);

  async parse(
    file: DataFile
  ): Promise<$ReadOnlyArray<TimelineEntry<CategoryKey>>> {
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

    if (file.path[2] === "Access Log Activity") {
      if (file.path[3].startsWith("Activities - ")) {
        return (await parseCSV(file.data)).map((row) =>
          entry(row, "security", DateTime.fromSQL(row["Activity Timestamp"]), [
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
              [`Edited "${parsed.title}"`, "Google Drive"]
            ),
          ];
        }
      }
    }
    return [];
  }
}

export default Google;
