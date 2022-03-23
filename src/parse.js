//@flow
import type { DataFile, Provider } from "provider";

export type ActivityEntry = {|
  type: "activity",
  file: DataFile,
  timestamp: number,
  description: string,
  label: string,
  value: any,
|};

export type MediaEntry = {|
  type: "media",
  file: DataFile,
|};

export type SettingEntry = {|
  type: "setting",
  file: DataFile,
  label: string,
  value: any,
|};

export type UnknownEntry = {|
  type: "unknown",
  file: DataFile,
|};

export type Entry = ActivityEntry | MediaEntry | SettingEntry | UnknownEntry;

export function autoParse(
  file: DataFile,
  provider: Provider
): $ReadOnlyArray<Entry> {
  const ext = file.path.split(".").slice(-1)[0];
  switch (ext) {
    case "json": {
      const parsed = parseJSON(file);

      const settingLabel = provider.settingLabels[file.path];
      if (settingLabel) {
        return [{ type: "setting", file, label: settingLabel, value: parsed }];
      }

      const activityLabel = provider.activityLabels[file.path];
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => discoverEntry(file, entry, activityLabel));
      }

      const keys = Object.keys(parsed);
      if (keys.length === 1 && Array.isArray(parsed[keys[0]])) {
        return parsed[keys[0]].map((entry) =>
          discoverEntry(file, entry, activityLabel)
        );
      }

      console.warn("TODO", file.path);
      return [{ type: "unknown", file }];
    }
    default: {
      // TODO: handle CSVs and plain text
      return [{ type: "media", file }];
    }
  }
}

export function discoverEntry(
  file: DataFile,
  obj: any,
  activityLabel: ?string
): Entry {
  const label =
    obj.name ||
    obj.title ||
    obj.text ||
    obj.action ||
    obj.event ||
    obj.advertiser_name ||
    JSON.stringify(obj);

  let timestamp =
    obj.timestamp ||
    obj.timestamp_ms ||
    obj.verification_time ||
    obj.start_timestamp ||
    obj.added_timestamp ||
    obj.removed_timestamp;
  if (timestamp > 9999999999) timestamp /= 1000;

  if (timestamp) {
    return {
      type: "activity",
      timestamp,
      file,
      description: activityLabel || "unknown: " + file.path,
      label,
      value: obj,
    };
  } else {
    return {
      type: "setting",
      file,
      label,
      value: obj,
    };
  }
}

export function parseJSON(file: DataFile): any {
  let text = new TextDecoder().decode(file.data);
  // TODO: better mojibake handling
  // $FlowFixMe[prop-missing]
  text = text.replaceAll("\\u00e2\\u0080\\u0099", "'");
  return JSON.parse(text);
}
