// @flow
import * as React from "react";

import { ExternalLink } from "components/Links";

import AmazonIcon from "icons/amazon.svg";

import type { Entry } from "parse";
import type { DataFile, Provider } from "provider";

class Amazon implements Provider<void> {
  slug: string = "amazon";
  displayName: string = "Amazon";
  icon: React.Node = (<AmazonIcon />);
  color: string = "#f90";

  privacyPolicy: string =
    "https://www.amazon.com/gp/help/customer/display.html?nodeId=GC5HB5DVMU5Y8CJ2";
  waitTime: string = "1–2 days";
  instructions: React.Node = (
    <ol>
      <li>
        Log in to{" "}
        <ExternalLink
          newTab
          to="https://amazon.com/gp/privacycentral/dsar/preview.html"
        >
          Request My Data
        </ExternalLink>
      </li>
      <li>
        Select <i>Request All Your Data</i> from the menu
      </li>
      <li>
        Hit <i>Submit Request</i>
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

export default Amazon;
