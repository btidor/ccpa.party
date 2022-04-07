// @flow
import * as React from "react";

import { ExternalLink } from "components/Links";

import AppleIcon from "icons/apple.svg";

import type { TimelineEntry } from "parse";
import type { DataFile, Provider, TimelineCategory } from "provider";

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
        <ExternalLink to="https://privacy.apple.com/" newTab>
          Data and Privacy
        </ExternalLink>
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

  timelineCategories: $ReadOnlyArray<TimelineCategory> = [];

  parse(files: DataFile): $ReadOnlyArray<TimelineEntry> {
    return []; // TODO
  }

  render(entry: TimelineEntry): React.Node {
    return <React.Fragment></React.Fragment>; // TODO
  }
}

export default Apple;
