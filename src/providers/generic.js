// @flow
import * as React from "react";

import { autoParse } from "database";

import type { DataFile, Entry, TimelineEntry } from "database";
import type { Provider, TimelineCategory } from "provider";

class Generic implements Provider {
  slug: string = "generic";
  displayName: string = "Generic";
  icon: React.Node = (<div />);
  color: string = "#000000";

  privacyPolicy: string = "";
  waitTime: string = "a generic amount of time";
  instructions: React.Node = (<div />);

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
