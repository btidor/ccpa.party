// @flow
import * as React from "react";

import GitHubIcon from "icons/github.svg";

import type { Entry } from "parse";
import type { DataFile, Provider } from "provider";

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
        <a
          href="https://github.com/settings/admin"
          target="_blank"
          rel="noreferrer"
        >
          Account Settings
        </a>
      </li>
      <li>
        Click <i>New export</i>
      </li>
      <li>Confirm your password, if prompted</li>
    </ol>
  );

  activityLabels: { [string]: string } = {};
  settingLabels: { [string]: string } = {};

  parse(files: $ReadOnlyArray<DataFile>): $ReadOnlyArray<Entry> {
    return []; // TODO
  }
}

export default GitHub;
