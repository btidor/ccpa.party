import { DateTime } from "luxon";
import { Minimatch } from "minimatch";

import { TimelineParser } from "@src/common/parse";
import type { Provider, TimelineCategory } from "@src/common/provider";

type CategoryKey = "account" | "activity" | "notification";

class Netflix implements Provider<CategoryKey> {
  slug = "netflix";
  displayName = "Netflix";

  brandColor = "#e50914";
  neonColor = "#ff0006";
  neonColorHDR = "color(rec2020 1.0185 0.26889 0.13682)";

  requestLink = {
    text: "Get My Info",
    href: "https://www.netflix.com/account/getmyinfo",
  };
  waitTime = "a day";
  instructions: ReadonlyArray<string> = [];
  singleFile = true;
  fileName = "netflix.zip";
  privacyPolicy = "https://help.netflix.com/legal/privacy#ccpa";

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
        icon: "🎞",
        displayName: "Activity",
        defaultEnabled: true,
      },
    ],
    [
      "notification",
      {
        char: "n",
        icon: "🔔",
        displayName: "Notifications",
        defaultEnabled: false,
      },
    ],
  ]);

  timelineParsers: ReadonlyArray<TimelineParser<CategoryKey>> = [
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
          ];
        }),
    },
    {
      glob: new Minimatch("CONTENT_INTERACTION/Ratings.csv"),
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
      parse: (item) => [
        "activity",
        DateTime.fromSQL(item["Utc Timestamp"], { zone: "UTC" }),
        ["Search", item["Query Typed"] || item["Displayed Name"]],
      ],
    },
    {
      glob: new Minimatch("CONTENT_INTERACTION/ViewingActivity.csv"),
      parse: (item) => [
        "activity",
        DateTime.fromSQL(item["Start Time"], { zone: "UTC" }),
        ["Viewing Activity", item["Title"]],
      ],
    },
    {
      glob: new Minimatch("DEVICES/Devices.csv"),
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
      parse: (item) => [
        "account",
        DateTime.fromISO(item["Profile Creation Time"]),
        ["Profile Created", item["Profile Name"]],
      ],
    },
  ];
}

export default Netflix;
