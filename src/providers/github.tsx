import { DateTime } from "luxon";

import type { DataFile, TimelineEntry } from "@/common/database";
import { getSlugAndDayTime, parseJSON } from "@/common/parse";
import type { Provider, TimelineCategory } from "@/common/provider";

type CategoryKey = "activity" | "message";

class GitHub implements Provider<CategoryKey> {
  slug: string = "github";
  displayName: string = "GitHub";

  brandColor: string = "#6e5494";
  neonColor: string = "#bd65ff";
  neonColorHDR: string = "color(rec2020 0.69493 0.4398 1.36255)";

  requestLink: { href: string; text: string } = {
    text: "Account Settings",
    href: "https://github.com/settings/admin",
  };
  waitTime: string = "15 minutes";
  instructions: ReadonlyArray<string> = [];
  singleFile: boolean = true;
  fileName: string = "tar.gz file";
  privacyPolicy: string =
    "https://docs.github.com/en/site-policy/privacy-policies/githubs-notice-about-the-california-consumer-privacy-act";

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
      "message",
      {
        char: "m",
        icon: "💬",
        displayName: "Messages",
        defaultEnabled: true,
      },
    ],
  ]);

  async parse(
    file: DataFile
  ): Promise<ReadonlyArray<TimelineEntry<CategoryKey>>> {
    const object = (url: string) => {
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
    const body = (body: string) => {
      const parts = body.split("\n");
      return parts.length > 1 ? parts[0] + " [...]" : parts[0];
    };

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
        .map((item: any) => {
          let category, title, trailer;

          if (item.type === "commit_comment" || item.type === "issue_comment") {
            category = "message";
            title = body(item.body);
            trailer = `${object(item.user)} commented on ${object(item.url)}`;
          } else if (item.type === "issue_event") {
            category = "activity";
            title =
              "Issue " +
              (item.event as string)
                .replace(/_/g, " ")
                .replace(
                  /\w\S*/g,
                  (w) => " " + w[0].toUpperCase() + w.slice(1)
                );
            trailer = `by ${object(item.actor)} on ${object(item.url)}`;
          } else if (item.type === "issue") {
            category = "message";
            title = item.title;
            trailer = `${object(item.user)} filed issue ${object(item.url)}`;
          } else if (item.type === "pull_request") {
            category = "message";
            title = item.title;
            trailer = `${object(item.user)} created pull request ${object(
              item.url
            )}`;
          } else if (item.type === "repository") {
            category = "activity";
            title = "Repository Created";
            trailer = object(item.url);
          } else {
            return undefined;
          }

          return {
            file: file.path,
            category,
            ...getSlugAndDayTime(
              DateTime.fromISO(item.created_at).toSeconds(),
              item
            ),
            context: [title, trailer],
            value: item,
          };
        })
        .filter((x?: TimelineEntry<CategoryKey>) => x);
    }
    return [];
  }
}

export default GitHub;
