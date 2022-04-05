// @flow
import * as React from "react";

import { autoParse } from "parse";

import type { Entry } from "parse";
import type { DataFile, Provider, TimelineCategory } from "provider";

class Generic implements Provider {
  slug: string = "generic";
  displayName: string = "Generic";
  icon: React.Node = (<div />);
  color: string = "#000";

  privacyPolicy: string = "";
  waitTime: string = "a generic amount of time";
  instructions: React.Node = (<div />);

  timelineCategories: $ReadOnlyArray<TimelineCategory> = [];

  parse(files: $ReadOnlyArray<DataFile>): $ReadOnlyArray<Entry> {
    return files.flatMap((file) => autoParse(file, {}, {}));
  }
}

export default Generic;
