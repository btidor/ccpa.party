// @flow
import * as React from "react";

import { autoParse } from "common/importer";

import type { DataFile, Entry, TimelineEntry } from "common/database";
import type { Provider, TimelineCategory } from "common/provider";

class Generic implements Provider {
  slug: string = "generic";
  displayName: string = "Generic";
  icon: React.Node = (<div />);
  color: string = "#000000";

  requestLink: {| href: string, text: string |} = {
    text: "...",
    href: "https://www.example.org/",
  };
  waitTime: string = "...unknown...";
  instructions: $ReadOnlyArray<string> = [];
  privacyPolicy: string = "";
  timelineCategories: $ReadOnlyArray<TimelineCategory> = [];

  async parse(file: DataFile): Promise<$ReadOnlyArray<Entry>> {
    return autoParse(file, {}, {});
  }

  render(entry: TimelineEntry): React.Node {
    return (
      <React.Fragment>
        ({entry.context[0]}) {entry.context[1]}
      </React.Fragment>
    );
  }
}

export default Generic;
