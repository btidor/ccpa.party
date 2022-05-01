// @flow
import * as React from "react";

import { ExternalLink } from "components/Links";

import GoogleIcon from "icons/google.svg";

import type { DataFile, Entry, TimelineEntry } from "database";
import type { Provider, TimelineCategory } from "provider";

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
        <ExternalLink to="https://takeout.google.com/" newTab>
          Google Takeout
        </ExternalLink>
      </li>
      <li>Check all of the boxes</li>
      {/* TODO: document additional required options */}
      <li>
        Hit <i>Next step</i>
      </li>
      <li>
        Leave the default settings and hit <i>Create export</i>
      </li>
    </ol>
  );

  timelineCategories: $ReadOnlyArray<TimelineCategory> = [];

  async parse(file: DataFile): Promise<$ReadOnlyArray<Entry>> {
    return []; // TODO
  }

  render(entry: TimelineEntry): React.Node {
    return <React.Fragment></React.Fragment>; // TODO
  }
}

export default Google;
