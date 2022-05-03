// @flow
import * as React from "react";

import type { DataFile, Entry, TimelineEntry } from "database";
import type { Provider, TimelineCategory } from "provider";

class Netflix implements Provider {
  slug: string = "netflix";
  displayName: string = "Netflix";
  color: string = "#e50914";

  requestLink: {| href: string, text: string |} = {
    text: "Get My Info",
    href: "https://www.netflix.com/account/getmyinfo",
  };
  waitTime: string = "TODO";
  instructions: $ReadOnlyArray<string> = [];
  privacyPolicy: string = "https://help.netflix.com/legal/privacy#ccpa";

  timelineCategories: $ReadOnlyArray<TimelineCategory> = [];

  async parse(file: DataFile): Promise<$ReadOnlyArray<Entry>> {
    return []; // TODO
  }

  render(entry: TimelineEntry): React.Node {
    return <React.Fragment></React.Fragment>; // TODO
  }
}

export default Netflix;
