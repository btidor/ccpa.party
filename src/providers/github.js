// @flow
import { DateTime } from "luxon";
import * as React from "react";

import { getSlugAndDayTime, parseJSON } from "common/parse";

import styles from "providers/simple.module.css";

import type { DataFile, Entry, TimelineEntry } from "common/database";
import type { Provider, TimelineCategory } from "common/provider";

class GitHub implements Provider {
  slug: string = "github";
  displayName: string = "GitHub";
  color: string = "#6e5494";

  requestLink: {| href: string, text: string |} = {
    text: "Account Settings",
    href: "https://github.com/settings/admin",
  };
  waitTime: string = "15 minutes";
  instructions: $ReadOnlyArray<string> = [];
  singleFile: boolean = true;
  privacyPolicy: string =
    "https://docs.github.com/en/site-policy/privacy-policies/githubs-notice-about-the-california-consumer-privacy-act";

  timelineCategories: $ReadOnlyArray<TimelineCategory> = [
    {
      char: "a",
      slug: "activity",
      displayName: "Activity",
      defaultEnabled: true,
    },
    {
      char: "m",
      slug: "message",
      displayName: "Messages",
      defaultEnabled: true,
    },
  ];

  async parse(file: DataFile): Promise<$ReadOnlyArray<Entry>> {
    const object = (url) => {
      const parts = url.split("/");
      const repo = parts[4];
      if (repo === undefined) return parts[3]; // user
      switch (parts[5]) {
        case undefined:
          return repo;
        case "commit":
          return `${repo}@${parts[6].slice(0, 8)}`;
        case "issues":
        case "pull":
          return `${repo}#${parts[6].split("#")[0]}`;
        default:
          throw new Error("Can't parse object: " + url);
      }
    };
    const body = (body) => {
      const parts = body.split("\n");
      return parts.length > 1 ? parts[0] + " [...]" : parts[0];
    };

    if (file.skipped) return [];
    const supportedPrefixes = [
      "commit_comments_",
      "issue_comments_",
      "issue_events_",
      "issues_",
      "pull_requests_",
      "repositories_",
    ];
    if (supportedPrefixes.some((p) => file.path[1].startsWith(p))) {
      return parseJSON(file.data)
        .map((item) => {
          let category, major, minor;

          if (item.type === "commit_comment" || item.type === "issue_comment") {
            category = "message";
            major = body(item.body);
            minor = `${object(item.user)} commented on ${object(item.url)}`;
          } else if (item.type === "issue_event") {
            category = "activity";
            major =
              "Issue " +
              item.event
                .replace(/_/g, " ")
                .replace(
                  /\w\S*/g,
                  (w) => " " + w[0].toUpperCase() + w.slice(1)
                );
            minor = `by ${object(item.actor)} on ${object(item.url)}`;
          } else if (item.type === "issue") {
            category = "message";
            major = item.title;
            minor = `${object(item.user)} filed issue ${object(item.url)}`;
          } else if (item.type === "pull_request") {
            category = "message";
            major = item.title;
            minor = `${object(item.user)} created pull request ${object(
              item.url
            )}`;
          } else if (item.type === "repository") {
            category = "activity";
            major = "Repository Created";
            minor = object(item.url);
          } else {
            return undefined;
          }

          const icon = category === "activity" ? "🖱" : "💬";
          return ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category,
            ...getSlugAndDayTime(
              DateTime.fromISO(item.created_at).toSeconds(),
              item
            ),
            context: [icon, major, minor],
            value: item,
          }: TimelineEntry);
        })
        .filter((x) => x);
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

export default GitHub;
