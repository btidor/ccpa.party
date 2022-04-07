// @flow
import * as React from "react";

import { ExternalLink } from "components/Links";

import GitHubIcon from "icons/github.svg";

import type { DataFile, TimelineEntry } from "parse";
import type { Provider, TimelineCategory } from "provider";

class GitHub implements Provider {
  slug: string = "github";
  displayName: string = "GitHub";
  icon: React.Node = (<GitHubIcon />);
  color: string = "#000";

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

  timelineCategories: $ReadOnlyArray<TimelineCategory> = [];

  parse(files: DataFile): $ReadOnlyArray<TimelineEntry> {
    return []; // TODO
  }

  render(entry: TimelineEntry): React.Node {
    return <React.Fragment></React.Fragment>; // TODO
  }
}

export default GitHub;
