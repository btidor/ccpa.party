// @flow
import * as React from "react";

import AmazonIcon from "icons/amazon.svg";

import type { Entry } from "parse";
import type { DataFile, Provider } from "provider";

class Amazon implements Provider {
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
        <a
          href="https://amazon.com/gp/privacycentral/dsar/preview.html"
          target="_blank"
          rel="noreferrer"
        >
          Request My Data
        </a>
      </li>
      <li>
        Select <i>Request All Your Data</i> from the menu
      </li>
      <li>
        Hit <i>Submit Request</i>
      </li>
    </ol>
  );

  activityLabels: { [string]: string } = {};
  settingLabels: { [string]: string } = {};

  parse(files: $ReadOnlyArray<DataFile>): $ReadOnlyArray<Entry> {
    return []; // TODO
  }
}

export default Amazon;
