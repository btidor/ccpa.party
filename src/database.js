//@flow
import { initBackend } from "absurd-sql/dist/indexeddb-main-thread";
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
  +key: string,
  +value: any,
|};

export type TimelineEntry = {|
  +type: "timeline",
  +file: string,
  +category: string,
  +timestamp: number,
  +day: string,
  +context: any,
  +value: { [string]: any },
|};

export class Database {
  #idb: Promise<any>;
  #worker: Worker;

  #messages: Map<string, (any) => void>;

  constructor() {
    this.#idb = openDB("import", 1, {
      async upgrade(db) {
        const files = db.createObjectStore("files", {
          keyPath: ["provider", "archive", "path"],
        });
        files.createIndex("provider", "provider", { unique: false });

        db.createObjectStore("fileData", {
          keyPath: ["provider", "archive", "path"],
        });

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

    // $FlowFixMe[incompatible-call]
    this.#worker = new Worker(new URL("worker.js", import.meta.url));
    // This is only required because Safari doesn't support nested
    // workers. This installs a handler that will proxy creating web
    // workers through the main thread
    initBackend(this.#worker);

    this.#messages = new Map();
    this.#worker.onmessage = (message) => {
      const { id, type, response } = (message.data: any);
      const resolve = this.#messages.get(id);
      if (resolve) resolve(response);
      else if (typeof type === "string" && type.startsWith("__absurd")) return;
      else console.warn("Received unknown response from worker", message);
    };
  }

  #message(command: string, params?: any): Promise<any> {
    return new Promise((resolve) => {
      const id = Math.random().toString();
      this.#messages.set(id, (result) => {
        this.#messages.delete(id);
        resolve(result);
      });
      this.#worker.postMessage({
        id,
        command,
        params,
      });
    });
  }

  async getAllFiles(): Promise<$ReadOnlyArray<DataFile>> {
    const db = await this.#idb;
    return await db.getAll("files");
  }

  async getFilesForProvider(
    provider: Provider
  ): Promise<$ReadOnlyArray<DataFile>> {
    const db = await this.#idb;
    return await db.getAllFromIndex("files", "provider", provider.slug);
  }

  async getFileWithData(file: DataFile): Promise<?DataFile> {
    const db = await this.#idb;
    return await db.get("fileData", [file.provider, file.archive, file.path]);
  }

  async putFile(file: DataFile): Promise<void> {
    const db = await this.#idb;
    const { data, ...rest } = file;
    await db.put("files", rest);
    await db.put("fileData", file);
  }

  async getMetadatasForProvider(
    provider: Provider
  ): Promise<$ReadOnlyArray<MetadataEntry>> {
    const db = await this.#idb;
    return await db.getAllFromIndex("metadata", "provider", provider.slug);
  }

  async putMetadata(
    provider: Provider,
    metadata: MetadataEntry
  ): Promise<void> {
    const db = await this.#idb;
    const { type, ...rest } = metadata;
    await db.put("metadata", { ...rest, provider: provider.slug });
  }

  async getParsedsForProvider(
    provider: Provider
  ): Promise<$ReadOnlyArray<TimelineEntry>> {
    return this.#message("getParsedsForProvider", provider.slug);
  }

  async putParseds(
    provider: Provider,
    entries: $ReadOnlyArray<TimelineEntry>
  ): Promise<void> {
    await this.#message("putParseds", [provider.slug, entries]);
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
