//@flow
import { openDB } from "idb";

import type { DataFile } from "provider";

export type MetadataEntry = {|
  type: "metadata",
  key: string,
  value: any,
|};

export type TimelineEntry = {|
  type: "timeline",
  file: string,
  category: string,
  timestamp: number,
  day: string,
  context: any,
  value: any,
|};

export function openFiles(): Promise<any> {
  return openDB("import", 1, {
    async upgrade(db) {
      const files = db.createObjectStore("files", {
        keyPath: ["archive", "path"],
      });
      files.createIndex("provider", "provider", { unique: false });

      const parsed = db.createObjectStore("parsed", {
        autoIncrement: true,
      });
      parsed.createIndex("provider", "provider", { unique: false });

      const metadata = db.createObjectStore("metadata", {
        keyPath: ["provider", "key"],
      });
      metadata.createIndex("provider", "provider", { unique: false });
    },
  });
}

export function autoParse(
  file: DataFile,
  timelineLabels: { [string]: [string, string] },
  settingLabels: { [string]: string }
): $ReadOnlyArray<TimelineEntry> {
  const ext = file.path.split(".").slice(-1)[0];
  switch (ext) {
    case "json": {
      const parsed = parseJSON(file);

      const settingLabel = settingLabels[file.path];
      if (settingLabel) {
        return []; // TODO: setting
      }

      const pair = timelineLabels[file.path];
      let timelineLabel, category;
      if (pair) [timelineLabel, category] = pair;

      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => discoverEntry(file, entry, timelineLabel, category))
          .filter((x) => x);
      }

      const keys = Object.keys(parsed);
      if (keys.length === 1 && Array.isArray(parsed[keys[0]])) {
        return parsed[keys[0]]
          .map((entry) => discoverEntry(file, entry, timelineLabel, category))
          .filter((x) => x);
      }
      return []; // TODO: unknown
    }
    default: {
      return []; // TODO: media
    }
  }
}

export function discoverEntry(
  file: DataFile,
  obj: any,
  timelineLabel: ?string,
  category: string
): ?TimelineEntry {
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

  return timestamp
    ? {
        type: "timeline",
        file: file.path,
        category,
        timestamp,
        day: getDay(timestamp),
        context: [timelineLabel || "unknown: " + file.path, label],
        value: obj,
      }
    : undefined; // TODO
}

export function parseJSON(file: DataFile): any {
  let text = new TextDecoder().decode(file.data);
  // TODO: better mojibake handling
  // $FlowFixMe[prop-missing]
  text = text.replaceAll("\\u00e2\\u0080\\u0099", "'");
  return JSON.parse(text);
}

export function getDay(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return (
    date.getFullYear().toString() +
    "-" +
    (date.getMonth() + 1).toString().padStart(2, "0") +
    "-" +
    date.getDate().toString().padStart(2, "0")
  );
}
