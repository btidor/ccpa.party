// @flow
import * as React from "react";

import { autoParse } from "parse";

import type { Entry } from "parse";
import type { DataFile, Provider } from "provider";

class Generic implements Provider {
  slug: string = "generic";
  displayName: string = "Generic";
  icon: React.Node = (<div />);
  color: string = "#000";

  privacyPolicy: string = "";
  waitTime: string = "a generic amount of time";
  instructions: React.Node = (<div />);

  activityLabels: { [string]: string } = {};
  settingLabels: { [string]: string } = {};

  parse(files: $ReadOnlyArray<DataFile>): $ReadOnlyArray<Entry> {
    return files.flatMap((file) => autoParse(file, this));
  }
}

export default Generic;