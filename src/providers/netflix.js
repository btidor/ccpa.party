// @flow
import * as React from "react";

import NetflixIcon from "icons/netflix.svg";

import { ExternalLink } from "components/Links";

import type { Entry } from "parse";
import type { DataFile, Provider } from "provider";

class Netflix implements Provider<void> {
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
        <ExternalLink to="https://www.netflix.com/account/getmyinfo" newTab>
          data request page
        </ExternalLink>
      </li>
      <li>
        Click <i>Submit Request</i>
      </li>
    </ol>
  );

  categoryLabels: $ReadOnlyMap<void, string> = new Map();
  timelineLabels: { [string]: [string, void] } = {};
  settingLabels: { [string]: string } = {};

  parse(files: $ReadOnlyArray<DataFile>): $ReadOnlyArray<Entry> {
    return []; // TODO
  }
}

export default Netflix;
