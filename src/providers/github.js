// @flow
import { DateTime } from "luxon";
import * as React from "react";

import { ExternalLink } from "components/Links";
import { getSlugAndDay, parseJSON } from "database";

import GitHubIcon from "icons/github.svg";

import type { DataFile, Entry, TimelineEntry } from "database";
import type { Provider, TimelineCategory } from "provider";

class GitHub implements Provider {
  slug: string = "github";
  displayName: string = "GitHub";
  icon: React.Node = (<GitHubIcon />);
  color: string = "#000000";
  darkColor: string = "#6e5494";

  privacyPolicy: string =
    "https://docs.github.com/en/site-policy/privacy-policies/githubs-notice-about-the-california-consumer-privacy-act";
  waitTime: string = "about 15 minutes";
  instructions: React.Node = (
    <ol>
      <li>
        Log in to{" "}
        <ExternalLink to="https://github.com/settings/admin" newTab>
          Account Settings
        </ExternalLink>
      </li>
      <li>
        Click <i>New export</i>
      </li>
      <li>Confirm your password, if prompted</li>
    </ol>
  );

  timelineCategories: $ReadOnlyArray<TimelineCategory> = [
    {
      char: "a",
      slug: "activity",
      displayName: "Activity",
      defaultEnabled: true,
    },
  ];

  async parse(file: DataFile): Promise<$ReadOnlyArray<Entry>> {
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
      return parseJSON(file.data).map(
        (item) =>
          ({
            type: "timeline",
            provider: file.provider,
            file: file.path,
            category: "activity",
            ...getSlugAndDay(
              DateTime.fromISO(item.created_at).toSeconds(),
              item
            ),
            context: item.type,
            value: item,
          }: TimelineEntry)
      );
    }
    return [];
  }

  render(entry: TimelineEntry): React.Node {
    const getUser = (url) => url.split("/").at(-1);
    const getRepo = (url) => url.split("/")[4];
    const getIssue = (url) => `${url.split("/")[4]}#${url.split("/")[6]}`;
    switch (entry.context) {
      case "commit_comment":
        return (
          <React.Fragment>
            {getUser(entry.value.user)} commented on{" "}
            {getRepo(entry.value.repository)}
            {"@"}
            {entry.value.commit_id.slice(0, 8)}
          </React.Fragment>
        );
      case "issue_comment":
        return (
          <React.Fragment>
            {getUser(entry.value.user)} commented on{" "}
            {getIssue(entry.value.pull_request)}
          </React.Fragment>
        );
      case "issue_event":
        return (
          <React.Fragment>
            {getUser(entry.value.actor)} performed action {entry.value.event} on{" "}
            {getIssue(entry.value.pull_request)}
          </React.Fragment>
        );
      case "issue":
        return (
          <React.Fragment>
            {getUser(entry.value.user)} filed issue {getIssue(entry.value.url)}
          </React.Fragment>
        );
      case "pull_request":
        return (
          <React.Fragment>
            {getUser(entry.value.user)} created pull request{" "}
            {getIssue(entry.value.url)}
          </React.Fragment>
        );
      case "repository":
        return (
          <React.Fragment>
            Repository created: {getRepo(entry.value.url)}
          </React.Fragment>
        );
      default:
        throw new Error("Unknown event: " + entry.context);
    }
  }
}

export default GitHub;
