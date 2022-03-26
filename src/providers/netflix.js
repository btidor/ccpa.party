// @flow
import * as React from "react";

import NetflixIcon from "icons/netflix.svg";

import type { Entry } from "parse";
import type { DataFile, Provider } from "provider";

class Netflix implements Provider {
  slug: string = "netflix";
  displayName: string = "Netflix";
  icon: React.Node = (<NetflixIcon />);
  color: string = "#000";
  fullColor: boolean = true;

  privacyPolicy: string = "https://help.netflix.com/legal/privacy#ccpa";
  waitTime: string = "an unknown amount of time";
  instructions: React.Node = (
    <ol>
      <li>
        Log in to the{" "}
        <a
          href="https://www.netflix.com/account/getmyinfo"
          target="_blank"
          rel="noreferrer"
        >
          data request page
        </a>
      </li>
      <li>
        Click <i>Submit Request</i>
      </li>
    </ol>
  );

  activityLabels: { [string]: string } = {};
  settingLabels: { [string]: string } = {};

  parse(files: $ReadOnlyArray<DataFile>): $ReadOnlyArray<Entry> {
    return []; // TODO
  }
}

export default Netflix;
