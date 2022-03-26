// @flow
import * as React from "react";

import AppleIcon from "icons/apple.svg";

import type { Entry } from "parse";
import type { DataFile, Provider } from "provider";

class Apple implements Provider {
  slug: string = "apple";
  displayName: string = "Apple";
  icon: React.Node = (<AppleIcon />);
  color: string = "#000";

  privacyPolicy: string = "https://www.apple.com/legal/privacy/california/";
  waitTime: string = "about a week";
  instructions: React.Node = (
    <ol>
      <li>
        Log in to{" "}
        <a href="https://privacy.apple.com/" target="_blank" rel="noreferrer">
          Data and Privacy
        </a>
      </li>
      <li>
        Select <i>Request a copy of your data</i>
      </li>
      <li>
        Click <i>Select all</i> in both of the two sections, then hit{" "}
        <i>Continue</i>
      </li>
      <li>
        Hit <i>Complete request</i>
      </li>
    </ol>
  );

  activityLabels: { [string]: string } = {};
  settingLabels: { [string]: string } = {};

  parse(files: $ReadOnlyArray<DataFile>): $ReadOnlyArray<Entry> {
    return []; // TODO
  }
}

export default Apple;