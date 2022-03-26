// @flow
import * as React from "react";

import GoogleIcon from "icons/google.svg";

import type { Entry } from "parse";
import type { DataFile, Provider } from "provider";

class Google implements Provider {
  slug: string = "google";
  displayName: string = "Google";
  icon: React.Node = (<GoogleIcon />);
  color: string = "#34a853";

  privacyPolicy: string =
    "https://policies.google.com/privacy?hl=en#california";
  waitTime: string = "up to a few days";
  instructions: React.Node = (
    <ol>
      <li>
        Log in to{" "}
        <a href="https://takeout.google.com/" target="_blank" rel="noreferrer">
          Google Takeout
        </a>
      </li>
      <li>Check all of the boxes</li>
      <li>
        Hit <i>Next step</i>
      </li>
      <li>
        Leave the default settings and hit <i>Create export</i>
      </li>
    </ol>
  );

  activityLabels: { [string]: string } = {};
  settingLabels: { [string]: string } = {};

  parse(files: $ReadOnlyArray<DataFile>): $ReadOnlyArray<Entry> {
    return []; // TODO
  }
}

export default Google;
