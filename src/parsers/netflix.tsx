import { DateTime } from "luxon";
import { Minimatch } from "minimatch";

import type {
  IgnoreParser,
  Parser,
  ProfileParser,
  TimelineParser,
  TimelineTuple,
} from "@src/common/parser";
import type { CategoryKey } from "@src/providers/netflix";
import { parseCSV } from "@src/worker/parse";

class Netflix implements Parser<CategoryKey> {
  slug = "netflix";

  profile: ProfileParser = {
    file: "PROFILES/Profiles.csv",
    extract: async (data) =>
      (await parseCSV(data)).map((item) => item["Profile Name"]),
  };

  ignore: ReadonlyArray<IgnoreParser> = [
    { glob: new Minimatch("Additional Information.pdf") },
    { glob: new Minimatch("Cover sheet.pdf") },

    // Settings
    { glob: new Minimatch("PROFILES/AvatarHistory.csv") },
  ];

  timeline: ReadonlyArray<TimelineParser<CategoryKey>> = [
    {
      glob: new Minimatch("ACCOUNT/AccountDetails.csv"),
      parse: (item) => [
        "account",
        DateTime.fromISO(item["Customer Creation Timestamp"]),
        ["Account Created", item["Email Address"]],
      ],
    },
    {
      glob: new Minimatch("ACCOUNT/SubscriptionHistory.csv"),
      parse: (item) => [
        "account",
        DateTime.fromSQL(item["Subscription Opened Ts"]),
        ["Subscription Started"],
      ],
    },
    {
      glob: new Minimatch("ACCOUNT/TermsOfUse.csv"),
      parse: (item) => [
        "account",
        DateTime.fromSQL(item["Tou Accepted Date"], { zone: "UTC" }),
        ["Accepted Terms of Use"],
      ],
    },
    {
      glob: new Minimatch("CLICKSTREAM/Clickstream.csv"),
      filter: (item, profile) => item["Profile Name"] === profile,
      parse: (item) => {
        let nav = item["Navigation Level"].replace(/([A-Z])/g, " $1");
        nav = nav[0].toUpperCase() + nav.slice(1);
        return [
          "activity",
          DateTime.fromSQL(item["Click Utc Ts"], { zone: "UTC" }),
          ["Click", `${nav} on ${item["Source"]}`],
        ];
      },
    },
    {
      glob: new Minimatch("CONTENT_INTERACTION/PlaybackRelatedEvents.csv"),
      filter: (item, profile) => item["Profile Name"] === profile,
      parse: (item) =>
        (
          JSON.parse(item.Playtraces) as {
            eventType: string;
            mediaOffsetMs: number;
            sessionOffsetMs: number;
          }[]
        ).map((trace) => {
          let type =
            "Playback " +
            trace.eventType[0].toUpperCase() +
            trace.eventType.slice(1);
          if (trace.eventType === "playing") type = "Playing";
          else if (trace.eventType === "start") type = "Playback Started";

          let offset = Math.trunc(trace.mediaOffsetMs / 1000);
          let mediaTime = (offset % 60).toString().padStart(2, "0");
          offset = Math.trunc(offset / 60);
          mediaTime =
            Math.trunc(offset % 60)
              .toString()
              .padStart(2, "0") +
            ":" +
            mediaTime;
          offset = Math.trunc(offset / 60);
          if (offset)
            mediaTime = Math.trunc(offset).toString() + ":" + mediaTime;

          return [
            "activity",
            DateTime.fromSQL(item["Playback Start Utc Ts"], {
              zone: "UTC",
            }).plus(trace.sessionOffsetMs),
            [type, `${item["Title Description"]} @ ${mediaTime}`],
          ] as TimelineTuple<CategoryKey>;
        }),
    },
    {
      glob: new Minimatch("CONTENT_INTERACTION/Ratings.csv"),
      filter: (item, profile) => item["Profile Name"] === profile,
      parse: (item) => [
        "account",
        DateTime.fromSQL(item["Event Utc Ts"], { zone: "UTC" }),
        [
          item["Rating Type"] === "thumb"
            ? item["Thumbs Value"] === "1"
              ? "Thumbs Down"
              : item["Thumbs Value"] === "2"
              ? "Thumbs Up"
              : "Rated"
            : "Rated",
          item["Title Name"],
        ],
      ],
    },
    {
      glob: new Minimatch("CONTENT_INTERACTION/SearchHistory.csv"),
      filter: (item, profile) => item["Profile Name"] === profile,
      parse: (item) => [
        "activity",
        DateTime.fromSQL(item["Utc Timestamp"], { zone: "UTC" }),
        ["Search", item["Query Typed"] || item["Displayed Name"]],
      ],
    },
    {
      glob: new Minimatch("CONTENT_INTERACTION/ViewingActivity.csv"),
      filter: (item, profile) => item["Profile Name"] === profile,
      parse: (item) => [
        "activity",
        DateTime.fromSQL(item["Start Time"], { zone: "UTC" }),
        ["Viewing Activity", item["Title"]],
      ],
    },
    {
      glob: new Minimatch("DEVICES/Devices.csv"),
      filter: (item, profile) => item["Profile Name"] === profile,
      parse: (item) =>
        [
          item["Acct First Playback Date"] && [
            "account",
            DateTime.fromISO(item["Acct First Playback Date"]),
            ["Device Activated", item["Device Type"]],
          ],
          item["Deactivation Time"] && [
            "account",
            DateTime.fromISO(item["Deactivation Time"]),
            ["Device Deactivated", item["Device Type"]],
          ],
        ].filter((x) => x),
    },
    {
      glob: new Minimatch("IP_ADDRESSES/IpAddressesLogin.csv"),
      parse: (item) => [
        "account",
        DateTime.fromSQL(item["Ts"], { zone: "UTC" }),
        ["Login", item["Ip"]],
      ],
    },
    {
      glob: new Minimatch("IP_ADDRESSES/IpAddressesStreaming.csv"),
      parse: (item) => [
        "account",
        DateTime.fromISO(item["Ts"]),
        ["Streaming Session", item["Ip"]],
      ],
    },
    {
      glob: new Minimatch("MESSAGES/MessagesSentByNetflix.csv"),
      filter: (item, profile) => item["Profile Name"] === profile,
      parse: (item) =>
        [
          [
            "notification",
            DateTime.fromSQL(item["Sent Utc Ts"], { zone: "UTC" }),
            [
              item["Channel"] === "EMAIL"
                ? "Email"
                : item["Channel"] === "NOTIFICATIONS"
                ? "In-App Notification"
                : item["Channel"] === "PUSH"
                ? "Push Notification"
                : "Notification",
              item["Title Name"],
            ],
          ],
          item["Click Utc Ts"] && [
            "notification",
            DateTime.fromSQL(item["Click Utc Ts"], { zone: "UTC" }),
            [
              (item["Channel"] === "EMAIL"
                ? "Email"
                : item["Channel"] === "NOTIFICATIONS"
                ? "In-App Notification"
                : item["Channel"] === "PUSH"
                ? "Push Notification"
                : "Notification") + " Click",
              item["Title Name"],
            ],
          ],
        ].filter((x) => x),
    },
    {
      glob: new Minimatch("PAYMENT_AND_BILLING/BillingHistory.csv"),
      parse: (item) => [
        "account",
        DateTime.fromSQL(item["Transaction Date"]),
        ["Payment Event"],
      ],
    },
    {
      glob: new Minimatch("PROFILES/Profiles.csv"),
      filter: (item, profile) => item["Profile Name"] === profile,
      parse: (item) => [
        "account",
        DateTime.fromISO(item["Profile Creation Time"]),
        ["Profile Created", item["Profile Name"]],
      ],
    },
  ];
}

export default Netflix;
