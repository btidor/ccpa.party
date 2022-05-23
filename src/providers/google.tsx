import { DateTime } from "luxon";
import { Minimatch } from "minimatch";

import type { DataFile, TimelineEntry } from "@/common/database";
import { parseByStages, parseCSV, parseJSON } from "@/common/parse";
import type { TimelineParser } from "@/common/parse";
import type { Provider, TimelineCategory } from "@/common/provider";

type CategoryKey = "activity" | "security";

class Google implements Provider<CategoryKey> {
  slug: string = "google";
  displayName: string = "Google";

  brandColor: string = "#34a853";
  neonColor: string = "#00c300";
  neonColorHDR: string = "color(rec2020 0.1856 0.71527 0.06415)";

  requestLink: { href: string; text: string } = {
    text: "Google Takeout",
    href: "https://takeout.google.com/",
  };
  waitTime: string = "1-2 days";
  instructions: ReadonlyArray<string> = [
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
      glob: new Minimatch("Takeout/My Activity/*/MyActivity.json"),
      tokenize: parseJSON,
      transform: (item) => {
        let { title, header } = item;
        if (item.details?.some((x: any) => x.name === "From Google Ads"))
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
      glob: new Minimatch("Takeout/Access Log Activity/Activities - *.csv"),
      tokenize: parseCSV,
      transform: (item) => [
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
      glob: new Minimatch("Drive/**/*-info.json"),
      tokenize: (data) => [parseJSON(data)],
      transform: (item) =>
        item.last_modified_by_me
          ? [
              "activity",
              DateTime.fromISO(item.last_modified_by_me),
              [`Edited "${item.title}"`, "Google Drive"],
            ]
          : undefined,
    },
  ];

  async parse(
    file: DataFile,
    metadata: Map<string, any>
  ): Promise<ReadonlyArray<TimelineEntry<CategoryKey>>> {
    return await parseByStages(file, metadata, this.timelineParsers, []);
  }
}

export default Google;
