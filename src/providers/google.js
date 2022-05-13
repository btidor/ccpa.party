// @flow
import * as React from "react";

import type { DataFile, Entry, TimelineEntry } from "common/database";
import type { Provider, TimelineCategory } from "common/provider";

class Google implements Provider {
  slug: string = "google";
  displayName: string = "Google";
  color: string = "#34a853";

  requestLink: {| href: string, text: string |} = {
    text: "Google Takeout",
    href: "https://takeout.google.com/",
  };
  waitTime: string = "a day or two";
  instructions: $ReadOnlyArray<string> = [
    `under My Activity`,
    `click Multiple Formats`,
    `change HTML to JSON`,
  ];
  singleFile: boolean = true;
  privacyPolicy: string =
    "https://policies.google.com/privacy?hl=en#california";

  timelineCategories: $ReadOnlyArray<TimelineCategory> = [];

  async parse(file: DataFile): Promise<$ReadOnlyArray<Entry>> {
    return []; // TODO
  }

  render(entry: TimelineEntry): React.Node {
    return <React.Fragment></React.Fragment>; // TODO
  }
}

export default Google;
