//@flow
import { openDB } from "idb";

import type { Provider } from "provider";

export type DataFile = {|
  +provider: string,
  +archive: string,
  +path: string,
  +data?: ArrayBuffer,
|};

export type MetadataEntry = {|
  +type: "metadata",
  +provider: string,
  +key: string,
  +value: any,
|};

export type TimelineEntry = {|
  +type: "timeline",
  +provider: string,
  +file: string,
  +category: string,
  +timestamp: number,
  +day: string,
  +context: any,
  +value: { [string]: any },
|};

const filesStore = "files";
const fileContentsStore = "fileContents";
const timelineStore = "timeline";
const metadataStore = "metadata";

const providerIndex = "provider";

export class Database {
  #idb: Promise<any>;

  constructor() {
    this.#idb = openDB("import", 1, {
      async upgrade(db) {
        const files = db.createObjectStore(filesStore, {
          keyPath: ["provider", "archive", "path"],
        });
        files.createIndex(providerIndex, "provider", { unique: false });

        db.createObjectStore(fileContentsStore, {
          keyPath: ["provider", "archive", "path"],
        });

        const timeline = db.createObjectStore(timelineStore, {
          autoIncrement: true,
        });
        timeline.createIndex(providerIndex, "provider", { unique: false });

        const metadata = db.createObjectStore(metadataStore, {
          keyPath: ["provider", "key"],
        });
        metadata.createIndex(providerIndex, "provider", { unique: false });
      },
    });
  }

  async getAllFiles(): Promise<$ReadOnlyArray<DataFile>> {
    const db = await this.#idb;
    return await db.getAll(filesStore);
  }

  async getFilesForProvider(
    provider: Provider
  ): Promise<$ReadOnlyArray<DataFile>> {
    const db = await this.#idb;
    return await db.getAllFromIndex(filesStore, providerIndex, provider.slug);
  }

  async getFileWithData(file: DataFile): Promise<?DataFile> {
    const db = await this.#idb;
    return await db.get(fileContentsStore, [
      file.provider,
      file.archive,
      file.path,
    ]);
  }

  async putFile(file: DataFile): Promise<void> {
    const db = await this.#idb;
    const { data, ...rest } = file;
    await db.put(filesStore, rest);
    await db.put(fileContentsStore, file);
  }

  async getMetadatasForProvider(
    provider: Provider
  ): Promise<$ReadOnlyArray<MetadataEntry>> {
    const db = await this.#idb;
    return await db.getAllFromIndex(
      metadataStore,
      providerIndex,
      provider.slug
    );
  }

  async putMetadata(metadata: MetadataEntry): Promise<void> {
    const db = await this.#idb;
    await db.put(metadataStore, metadata);
  }

  async getTimelineEntriesForProvider(
    provider: Provider
  ): Promise<$ReadOnlyArray<TimelineEntry>> {
    const db = await this.#idb;
    return await db.getAllFromIndex(timelineStore, providerIndex);
  }

  async putTimelineEntries(
    entries: $ReadOnlyArray<TimelineEntry>
  ): Promise<void> {
    const db = await this.#idb;
    for (const entry of entries) {
      await db.put(timelineStore, entry);
    }
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
