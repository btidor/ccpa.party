// @flow
import { DateTime } from "luxon";
import * as React from "react";

import { getSlugAndDayTime, parseCSV } from "common/parse";
import SimpleRecord from "components/SimpleRecord";

import type { DataFile, Entry, TimelineEntry } from "common/database";
import type { Provider, TimelineCategory } from "common/provider";

class Netflix implements Provider {
  slug: string = "netflix";
  displayName: string = "Netflix";

  brandColor: string = "#e50914";
  darkColor: string = "#ff0006";
  darkColorHDR: string = "color(rec2020 1.0185 0.26889 0.13682)";

  requestLink: {| href: string, text: string |} = {
    text: "Get My Info",
    href: "https://www.netflix.com/account/getmyinfo",
  };
  waitTime: string = "a day";
  instructions: $ReadOnlyArray<string> = [];
  singleFile: boolean = true;
  privacyPolicy: string = "https://help.netflix.com/legal/privacy#ccpa";

  timelineCategories: $ReadOnlyArray<TimelineCategory> = [
    {
      char: "c",
      icon: "🪪",
      slug: "account",
      displayName: "Account",
      defaultEnabled: true,
    },
    {
      char: "a",
      icon: "🎞",
      slug: "activity",
      displayName: "Activity",
      defaultEnabled: true,
    },
    {
      char: "n",
      icon: "🔔",
      slug: "notification",
      displayName: "Notifications",
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

    if (file.path[1] === "ACCOUNT") {
      if (file.path[2] === "AccountDetails.csv") {
        return (await parseCSV(file.data)).map((row) =>
          entry(
            row,
            "account",
            DateTime.fromISO(row["Customer Creation Timestamp"]),
            ["Account Created", row["Email Address"]]
          )
        );
      } else if (file.path[2] === "SubscriptionHistory.csv") {
        return (await parseCSV(file.data)).map((row) =>
          entry(
            row,
            "account",
            DateTime.fromSQL(row["Subscription Opened Ts"]),
            ["Subscription Started"]
          )
        );
      } else if (file.path[2] === "TermsOfUse.csv") {
        return (await parseCSV(file.data)).map((row) =>
          entry(
            row,
            "account",
            DateTime.fromSQL(row["Tou Accepted Date"], { zone: "UTC" }),
            ["Accepted Terms of Use"]
          )
        );
      }
    } else if (file.path[1] === "CLICKSTREAM") {
      if (file.path[2] === "Clickstream.csv") {
        return (await parseCSV(file.data)).map((row) => {
          let nav = row["Navigation Level"].replace(/([A-Z])/g, " $1");
          nav = nav[0].toUpperCase() + nav.slice(1);
          return entry(
            row,
            "activity",
            DateTime.fromSQL(row["Click Utc Ts"], { zone: "UTC" }),
            ["Click", `${nav} on ${row["Source"]}`]
          );
        });
      }
    } else if (file.path[1] === "CONTENT_INTERACTION") {
      if (file.path[2] === "PlaybackRelatedEvents.csv") {
        return (await parseCSV(file.data)).flatMap((row) =>
          JSON.parse(row.Playtraces).map((trace) => {
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

            return entry(
              row,
              "activity",
              DateTime.fromSQL(row["Playback Start Utc Ts"], {
                zone: "UTC",
              }).plus(trace.sessionOffsetMs),
              [type, `${row["Title Description"]} @ ${mediaTime}`]
            );
          })
        );
      } else if (file.path[2] === "Ratings.csv") {
        return (await parseCSV(file.data)).map((row) =>
          entry(
            row,
            "account",
            DateTime.fromSQL(row["Event Utc Ts"], { zone: "UTC" }),
            [
              row["Rating Type"] === "thumb"
                ? row["Thumbs Value"] === "1"
                  ? "Thumbs Down"
                  : row["Thumbs Value"] === "2"
                  ? "Thumbs Up"
                  : "Rated"
                : "Rated",
              row["Title Name"],
            ]
          )
        );
      } else if (file.path[2] === "SearchHistory.csv") {
        return (await parseCSV(file.data)).map((row) =>
          entry(
            row,
            "activity",
            DateTime.fromSQL(row["Utc Timestamp"], { zone: "UTC" }),
            ["Search", row["Query Typed"] || row["Displayed Name"]]
          )
        );
      } else if (file.path[2] === "ViewingActivity.csv") {
        return (await parseCSV(file.data)).map((row) =>
          entry(
            row,
            "activity",
            DateTime.fromSQL(row["Start Time"], { zone: "UTC" }),
            ["Viewing Activity", row["Title"]]
          )
        );
      }
    } else if (file.path[1] === "DEVICES") {
      if (file.path[2] === "Devices.csv") {
        return ((await parseCSV(file.data)).flatMap((row) =>
          [
            row["Acct First Playback Date"] &&
              entry(
                row,
                "account",
                DateTime.fromISO(row["Acct First Playback Date"]),
                ["Device Activated", row["Device Type"]]
              ),
            row["Deactivation Time"] &&
              entry(
                row,
                "account",
                DateTime.fromISO(row["Deactivation Time"]),
                ["Device Deactivated", row["Device Type"]]
              ),
          ].filter((x) => x)
        ): any);
      }
    } else if (file.path[1] === "IP_ADDRESSES") {
      if (file.path[2] === "IpAddressesLogin.csv") {
        return (await parseCSV(file.data)).map((row) =>
          entry(row, "account", DateTime.fromSQL(row["Ts"], { zone: "UTC" }), [
            "Login",
            row["Ip"],
          ])
        );
      } else if (file.path[2] === "IpAddressesStreaming.csv") {
        return (await parseCSV(file.data)).map((row) =>
          entry(row, "account", DateTime.fromISO(row["Ts"]), [
            "Streaming Session",
            row["Ip"],
          ])
        );
      }
    } else if (file.path[1] === "MESSAGES") {
      if (file.path[2] === "MessagesSentByNetflix.csv") {
        return (await parseCSV(file.data)).map((row) =>
          entry(
            row,
            "notification",
            DateTime.fromSQL(row["Sent Utc Ts"], { zone: "UTC" }),
            [
              row["Channel"] === "EMAIL"
                ? "Email"
                : row["Channel"] === "NOTIFICATIONS"
                ? "In-App Notification"
                : row["Channel"] === "PUSH"
                ? "Push Notification"
                : "Notification",
              row["Title Name"],
            ]
          )
        );
      }
    } else if (file.path[1] === "PAYMENT_AND_BILLING") {
      if (file.path[2] === "BillingHistory.csv") {
        return (await parseCSV(file.data)).map((row) =>
          entry(row, "account", DateTime.fromSQL(row["Transaction Date"]), [
            "Payment Event",
          ])
        );
      }
    } else if (file.path[1] === "PROFILES") {
      if (file.path[2] === "Profiles.csv") {
        return (await parseCSV(file.data)).map((row) =>
          entry(
            row,
            "account",
            DateTime.fromISO(row["Profile Creation Time"]),
            ["Profile Created", row["Profile Name"]]
          )
        );
      }
    }
    return [];
  }

  render(entry: TimelineEntry, time: ?string): React.Node {
    const [body, trailer] = entry.context;
    return (
      <SimpleRecord
        time={time}
        icon={
          this.timelineCategories.find((c) => c.slug === entry.category)?.icon
        }
        body={body}
        trailer={trailer}
      />
    );
  }
}

export default Netflix;
