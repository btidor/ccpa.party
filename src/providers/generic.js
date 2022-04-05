// @flow
import * as React from "react";

import { autoParse } from "parse";

import type { Entry } from "parse";
import type { DataFile, Provider } from "provider";

class Generic implements Provider<void> {
  slug: string = "generic";
  displayName: string = "Generic";
  icon: React.Node = (<div />);
  color: string = "#000";

  privacyPolicy: string = "";
  waitTime: string = "a generic amount of time";
  instructions: React.Node = (<div />);

  categoryLabels: $ReadOnlyMap<void, string> = new Map();
  timelineLabels: { [string]: [string, void] } = {};
  settingLabels: { [string]: string } = {};

  parse(files: $ReadOnlyArray<DataFile>): $ReadOnlyArray<Entry> {
    return files.flatMap((file) => autoParse(file, this));
  }
}

export default Generic;
