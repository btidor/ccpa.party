//@flow
import { openDB } from "idb";

import type { Provider } from "provider";

export type DataFileKey = {|
  +provider: string,
  +archive: string,
  +path: string,
|};

export type DataFile = {|
  ...DataFileKey,
  +data: ArrayBuffer,
|};

export type MetadataEntry = {|
  +type: "metadata",
  +provider: string,
  +key: string,
  +value: any,
|};

export type TimelineEntryKey = {|
  +type: "timeline",
  +provider: string,
  +file: string,
  +category: string,
  +timestamp: number,
  +day: string,
|};

export type TimelineEntry = {|
  ...TimelineEntryKey,
  +context: any,
  +value: { [string]: any },
|};

const filesStore = "files";
const timelineStore = "timeline";
const metadataStore = "metadata";

// When searching by provider we need to query the primary key index. If we
// instead create a secondary index for provider lookups, queries are somehow
// O(n) in the size of the entire table.
const providerRange = (provider) =>
  // $FlowFixMe[prop-missing]
  IDBKeyRange.bound([provider.slug], [provider.slug + " "]);

export class Database {
  #idb: Promise<any>;

  constructor() {
    this.#idb = openDB("import", 1, {
      async upgrade(db) {
        db.createObjectStore(filesStore, {
          keyPath: ["provider", "archive", "path"],
        });
        db.createObjectStore(timelineStore, {
          keyPath: ["provider", "category", "timestamp", "day", "file"],
        });
        db.createObjectStore(metadataStore, {
          keyPath: ["provider", "key"],
        });
      },
    });
  }

  async getAllFiles(): Promise<$ReadOnlyArray<DataFileKey>> {
    const db = await this.#idb;
    return (await db.getAllKeys(filesStore)).map(
      ([provider, archive, path]) => ({ provider, archive, path }: DataFileKey)
    );
  }

  async getFilesForProvider(
    provider: Provider
  ): Promise<$ReadOnlyArray<DataFileKey>> {
    const db = await this.#idb;
    return (await db.getAllKeys(filesStore, providerRange(provider))).map(
      ([provider, archive, path]) => ({ provider, archive, path }: DataFileKey)
    );
  }

  async hydrateFile(file: DataFileKey): Promise<?DataFile> {
    const db = await this.#idb;
    return await db.get(filesStore, [file.provider, file.archive, file.path]);
  }

  async putFile(file: DataFile): Promise<void> {
    const db = await this.#idb;
    await db.put(filesStore, file);
  }

  async getMetadatasForProvider(
    provider: Provider
  ): Promise<$ReadOnlyArray<MetadataEntry>> {
    const db = await this.#idb;
    return await db.getAll(metadataStore, providerRange(provider));
  }

  async putMetadata(metadata: MetadataEntry): Promise<void> {
    const db = await this.#idb;
    await db.put(metadataStore, metadata);
  }

  async getTimelineEntriesForProvider(
    provider: Provider
  ): Promise<$ReadOnlyArray<TimelineEntryKey>> {
    const db = await this.#idb;
    return (await db.getAllKeys(timelineStore, providerRange(provider))).map(
      ([provider, category, timestamp, day, file]) =>
        ({
          type: "timeline",
          provider,
          category,
          timestamp,
          day,
          file,
        }: TimelineEntryKey)
    );
  }

  async putTimelineEntries(
    entries: $ReadOnlyArray<TimelineEntry>
  ): Promise<void> {
    const db = await this.#idb;
    for (const entry of entries) {
      await db.put(timelineStore, entry);
    }
  }

  async hydrateTimelineEntry(entry: TimelineEntryKey): Promise<?TimelineEntry> {
    const db = await this.#idb;
    return await db.get(timelineStore, [
      entry.provider,
      entry.category,
      entry.timestamp,
      entry.day,
      entry.file,
    ]);
  }
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
        provider: file.provider,
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
