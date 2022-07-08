import { DateTime } from "luxon";
import { Minimatch } from "minimatch";

import type { IgnoreParser, Parser, TimelineParser } from "@src/common/parser";
import type { CategoryKey } from "@src/providers/github";

class GitHub implements Parser<CategoryKey> {
  slug = "github";

  ignore: ReadonlyArray<IgnoreParser> = [
    { glob: new Minimatch("schema.json") },
    { glob: new Minimatch("repositories/**", { dot: true }) },

    // Settings
    { glob: new Minimatch("protected_branches_*.json") },

    // Metadata
    { glob: new Minimatch("bots_*.json") },
    { glob: new Minimatch("users_*.json") },
  ];

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

  timeline: ReadonlyArray<TimelineParser<CategoryKey>> = [
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
