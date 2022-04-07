// @flow
import * as React from "react";

import { autoParse } from "parse";

import type { DataFile, TimelineEntry } from "parse";
import type { Provider, TimelineCategory } from "provider";

class Generic implements Provider {
  slug: string = "generic";
  displayName: string = "Generic";
  icon: React.Node = (<div />);
  color: string = "#000";

  privacyPolicy: string = "";
  waitTime: string = "a generic amount of time";
  instructions: React.Node = (<div />);

  timelineCategories: $ReadOnlyArray<TimelineCategory> = [];

  parse(file: DataFile): $ReadOnlyArray<TimelineEntry> {
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
