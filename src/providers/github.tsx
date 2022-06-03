import { DateTime } from "luxon";
import { Minimatch } from "minimatch";

import { IgnoreParser, TimelineParser } from "@src/common/parse";
import type { Provider, TimelineCategory } from "@src/common/provider";

type CategoryKey = "activity" | "message";

class GitHub implements Provider<CategoryKey> {
  slug = "github";
  displayName = "GitHub";

  brandColor = "#6e5494";
  neonColor = "#bd65ff";
  neonColorHDR = "color(rec2020 0.69493 0.4398 1.36255)";

  requestLink = {
    text: "Account Settings",
    href: "https://github.com/settings/admin",
  };
  waitTime = "15 minutes";
  instructions: ReadonlyArray<string> = [];
  singleFile = true;
  fileName = "tar.gz file";
  privacyPolicy =
    "https://docs.github.com/en/site-policy/privacy-policies/githubs-notice-about-the-california-consumer-privacy-act";

  ignoreParsers: ReadonlyArray<IgnoreParser> = [
    { glob: new Minimatch("schema.json") },
    { glob: new Minimatch("repositories/**", { dot: true }) },

    // Settings
    { glob: new Minimatch("protected_branches_*.json") },

    // Metadata
    { glob: new Minimatch("bots_*.json") },
    { glob: new Minimatch("users_*.json") },
  ];

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

  obj = (url: string) => {
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

  body = (body: string) => {
    const parts = body.split("\n");
    return parts.length > 1 ? parts[0] + " [...]" : parts[0];
  };

  timelineParsers: ReadonlyArray<TimelineParser<CategoryKey>> = [
    {
      glob: new Minimatch("commit_comments_*.json"),
      parse: (item) => [
        "message",
        DateTime.fromISO(item.created_at),
        [
          this.body(item.body),
          `${this.obj(item.user)} commented on ${this.obj(item.url)}`,
        ],
      ],
    },
    {
      glob: new Minimatch("issue_comments_*.json"),
      parse: (item) => [
        "message",
        DateTime.fromISO(item.created_at),
        [
          this.body(item.body),
          `${this.obj(item.user)} commented on ${this.obj(item.url)}`,
        ],
      ],
    },
    {
      glob: new Minimatch("issue_events_*.json"),
      parse: (item) => [
        "activity",
        DateTime.fromISO(item.created_at),
        [
          "Issue " +
            (item.event as string)
              .replace(/_/g, " ")
              .replace(/\w\S*/g, (w) => " " + w[0].toUpperCase() + w.slice(1)),
          `by ${this.obj(item.actor)} on ${this.obj(item.url)}`,
        ],
      ],
    },
    {
      glob: new Minimatch("issue_events_*.json"),
      parse: (item) => [
        "activity",
        DateTime.fromISO(item.created_at),
        [
          "Issue " +
            (item.event as string)
              .replace(/_/g, " ")
              .replace(/\w\S*/g, (w) => " " + w[0].toUpperCase() + w.slice(1)),
          `by ${this.obj(item.actor)} on ${this.obj(item.url)}`,
        ],
      ],
    },
    {
      glob: new Minimatch("issues_*.json"),
      parse: (item) => [
        "message",
        DateTime.fromISO(item.created_at),
        [
          item.title,
          `${this.obj(item.user)} filed issue ${this.obj(item.url)}`,
        ],
      ],
    },
    {
      glob: new Minimatch("pull_requests_*.json"),
      parse: (item) => [
        "message",
        DateTime.fromISO(item.created_at),
        [
          item.title,
          `${this.obj(item.user)} created pull request ${this.obj(item.url)}`,
        ],
      ],
    },
    {
      glob: new Minimatch("repositories_*.json"),
      parse: (item) => [
        "activity",
        DateTime.fromISO(item.created_at),
        ["Repository Created", this.obj(item.url)],
      ],
    },
  ];
}

export default GitHub;
