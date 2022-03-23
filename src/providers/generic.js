// @flow
import { autoParse } from "parse";

import type { Entry } from "parse";
import type { DataFile, Provider } from "provider";

class Generic implements Provider {
  slug: string = "generic";
  displayName: string = "Generic";

  activityLabels: { [string]: string } = {};
  settingLabels: { [string]: string } = {};

  parse(files: $ReadOnlyArray<DataFile>): $ReadOnlyArray<Entry> {
    return files.flatMap((file) => autoParse(file, this));
  }
}

export default Generic;
