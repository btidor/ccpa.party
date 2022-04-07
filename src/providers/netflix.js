// @flow
import * as React from "react";

import NetflixIcon from "icons/netflix.svg";

import { ExternalLink } from "components/Links";

import type { TimelineEntry } from "parse";
import type { DataFile, Provider, TimelineCategory } from "provider";

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
        <ExternalLink to="https://www.netflix.com/account/getmyinfo" newTab>
          data request page
        </ExternalLink>
      </li>
      <li>
        Click <i>Submit Request</i>
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

export default Netflix;
