//@flow
import csv from "csvtojson";
import { openDB } from "idb";
import MurmurHash3 from "imurmurhash";

import type { Provider } from "common/provider";

export type DataFileKey = {|
  +provider: string,
  +path: $ReadOnlyArray<string>,
|};

export type DataFile =
  | {|
      ...DataFileKey,
      +data: ArrayBuffer,
      +skipped: void,
    |}
  | {|
      ...DataFileKey,
      +data: void,
      +skipped: "tooLarge",
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
  +day: string,
  +slug: string,
  +category: string,
|};

export type TimelineEntry = {|
  ...TimelineEntryKey,
  +file: $ReadOnlyArray<string>,
  +context: any,
  +value: { [string]: any },
|};

export type Entry = MetadataEntry | TimelineEntry;

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
  #enc: TextEncoder;
  #dec: TextDecoder;
  #key: any;

  constructor(terminated: ?() => void) {
    this.#idb = openDB("import", 1, {
      async upgrade(db) {
        db.createObjectStore(filesStore);
        db.createObjectStore(timelineStore);
        db.createObjectStore(metadataStore);
      },
      async terminated(db) {
        terminated?.();
      },
    });
    this.#enc = new TextEncoder();
    this.#dec = new TextDecoder();

    // We encrypt the data and store the key in a cookie because (a) values in
    // the browser cookie jar are strongly protected using OS-level data
    // protection APIs and it's not clear the same is true of data in
    // IndexedDB, and (b) we can force the key to expire after 24 hours.
    const raw = document.cookie.split(";").find((x) => x.startsWith("key="));
    if (raw) {
      const dec = new Uint8Array(
        [...atob(raw.slice(4))].map((c) => c.charCodeAt(0))
      );
      this.#key = window.crypto.subtle.importKey("raw", dec, "AES-GCM", true, [
        "encrypt",
        "decrypt",
      ]);
    } else {
      this.#key = window.crypto.subtle
        .generateKey(
          {
            name: "AES-GCM",
            length: 256,
          },
          true,
          ["encrypt", "decrypt"]
        )
        .then((key) => window.crypto.subtle.exportKey("raw", key))
        .then((buf) =>
          btoa(
            [...new Uint8Array(buf)].map((c) => String.fromCharCode(c)).join("")
          )
        )
        .then((enc) => (document.cookie = `key=${enc}; max-age=86400; secure`));
    }
  }

  async getAllFiles(): Promise<Array<DataFileKey>> {
    const db = await this.#idb;
    return (await db.getAllKeys(filesStore)).map(
      ([provider, path]) => ({ provider, path }: DataFileKey)
    );
  }

  async getFilesForProvider(provider: Provider): Promise<Array<DataFileKey>> {
    const db = await this.#idb;
    return (await db.getAllKeys(filesStore, providerRange(provider))).map(
      ([provider, path]) => ({ provider, path }: DataFileKey)
    );
  }

  async hydrateFile(file: DataFileKey): Promise<?DataFile> {
    const db = await this.#idb;
    const [iv, enc] = await db.get(filesStore, [file.provider, file.path]);
    const data = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await this.#key,
      enc
    );
    return {
      path: file.path,
      provider: file.provider,
      skipped: undefined,
      data: (data: ArrayBuffer),
    };
  }

  async putFile(file: DataFile): Promise<void> {
    const db = await this.#idb;
    const iv = await window.crypto.getRandomValues(new Uint8Array(12));
    const enc = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await this.#key,
      file.data
    );
    await db.put(filesStore, [iv, enc], [file.provider, file.path]);
  }

  async getMetadatasForProvider(
    provider: Provider
  ): Promise<Array<MetadataEntry>> {
    const db = await this.#idb;
    const encs = await db.getAll(metadataStore, providerRange(provider));
    const results = [];
    for (const [iv, enc] of encs) {
      const data = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        await this.#key,
        enc
      );
      results.push(JSON.parse(this.#dec.decode(data)));
    }
    return results;
  }

  async putMetadata(metadata: MetadataEntry): Promise<void> {
    const db = await this.#idb;
    const iv = await window.crypto.getRandomValues(new Uint8Array(12));
    const enc = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await this.#key,
      this.#enc.encode(JSON.stringify(metadata))
    );
    await db.put(metadataStore, [iv, enc], [metadata.provider, metadata.key]);
  }

  async getTimelineEntriesForProvider(
    provider: Provider
  ): Promise<Array<TimelineEntryKey>> {
    const db = await this.#idb;
    return (await db.getAllKeys(timelineStore, providerRange(provider))).map(
      ([provider, slug, day, category]) =>
        ({
          type: "timeline",
          provider,
          slug,
          day,
          category,
        }: TimelineEntryKey)
    );
  }

  async putTimelineEntry(entry: TimelineEntry): Promise<void> {
    const db = await this.#idb;
    const iv = await window.crypto.getRandomValues(new Uint8Array(12));
    const enc = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await this.#key,
      this.#enc.encode(JSON.stringify(entry))
    );
    await db.put(
      timelineStore,
      [iv, enc],
      [entry.provider, entry.slug, entry.day, entry.category]
    );
  }

  async hydrateTimelineEntry(entry: TimelineEntryKey): Promise<?TimelineEntry> {
    const db = await this.#idb;
    const [iv, enc] = await db.get(timelineStore, [
      entry.provider,
      entry.slug,
      entry.day,
      entry.category,
    ]);
    const data = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await this.#key,
      enc
    );
    return JSON.parse(this.#dec.decode(data));
  }

  async getTimelineEntryBySlug(
    provider: Provider,
    slug: string
  ): Promise<?TimelineEntry> {
    const db = await this.#idb;
    const [iv, enc] = await db.get(
      timelineStore,
      // $FlowFixMe[prop-missing]
      IDBKeyRange.bound([provider.slug, slug], [provider.slug, slug + " "])
    );
    const data = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await this.#key,
      enc
    );
    return JSON.parse(this.#dec.decode(data));
  }
}

export async function autoParse(
  file: DataFile,
  timelineLabels: { [string]: [string, string] },
  settingLabels: { [string]: string }
): Promise<$ReadOnlyArray<TimelineEntry>> {
  if (file.skipped) return [];
  const ext = file.path.slice(-1)[0].split(".").slice(-1)[0];
  switch (ext) {
    case "json": {
      const parsed = parseJSON(file.data);

      const settingLabel = settingLabels[file.path.slice(1).join("/")];
      if (settingLabel) {
        return [];
      }

      const pair = timelineLabels[file.path.slice(1).join("/")];
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
      return [];
    }
    default: {
      return [];
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
        ...getSlugAndDay(timestamp, obj),
        context: [timelineLabel || "unknown: " + file.path.join("/"), label],
        value: obj,
      }
    : undefined;
}

const printableRegExp =
  /^(\p{L}|\p{M}|\p{N}|\p{S}|\p{P}|\p{Z}|\p{Cf}|\n|\r|\t)*$/u;
const utf8Decoder = new TextDecoder("utf-8");
const utf16beDecoder = new TextDecoder("utf-16be");
const jsonReviver = (key: any, value: any): any =>
  typeof value === "string" ? smartDecodeText(value) : value;
const isPrintableUnicode = (str: string): boolean =>
  Array.from(str).every((c) => printableRegExp.test(c));

export function parseJSON(data: ArrayBuffer | string): any {
  let text;
  if (typeof data === "string") text = data;
  else text = utf8Decoder.decode(data);

  try {
    return JSON.parse(text, jsonReviver);
  } catch (err) {
    if (typeof data === "string") throw err;

    // Seen in some Apple *.pkpass files
    text = utf16beDecoder.decode(data);
    return JSON.parse(text, jsonReviver);
  }
}

export async function parseCSV(
  data: ArrayBuffer | string
): Promise<$ReadOnlyArray<{ [string]: string }>> {
  let text;
  if (typeof data === "string") text = data;
  else text = smartDecode(data);

  return await csv().fromString(text);
}

// Some companies (e.g. Amazon, Facebook) mis-encode some of their files, for
// instance by applying UTF-8 encoding twice.
export function smartDecode(data: ArrayBuffer): string {
  // Simple UTF-8
  let text = utf8Decoder.decode(data);
  if (isPrintableUnicode(text)) return text;

  // Double-encoded UTF-8
  text = utf8Decoder.decode(
    // $FlowFixMe[incompatible-call]
    // $FlowFixMe[prop-missing]
    Uint8Array.from(text, (x) => x.charCodeAt(0))
  );
  if (isPrintableUnicode(text)) return text;

  // UTF-16 big-endian (used in some Apple JSON files)
  text = utf16beDecoder.decode(data);
  if (isPrintableUnicode(text)) return text;

  console.warn(
    data,
    Array.from(utf8Decoder.decode(data)).filter((c) => !printableRegExp.test(c))
  );
  throw new Error("Could not decode data to a printable Unicode string");
}

export function smartDecodeText(text: string): string {
  if (isPrintableUnicode(text)) return text;

  // Try double-encoded UTF-8
  text = utf8Decoder.decode(
    // $FlowFixMe[incompatible-call]
    // $FlowFixMe[prop-missing]
    Uint8Array.from(text, (x) => x.charCodeAt(0))
  );
  if (isPrintableUnicode(text)) return text;

  console.warn(
    text,
    Array.from(text).filter((c) => !printableRegExp.test(c))
  );
  throw new Error("Could not decode text to a printable Unicode string");
}

export function getSlugAndDay(
  timestamp: number,
  value: any
): {|
  slug: string,
  day: string,
|} {
  if (isNaN(timestamp)) throw new Error("Received NaN for timestamp");
  const hash = MurmurHash3(JSON.stringify(value));
  const slug =
    parseInt(timestamp).toString(16).padStart(8, "0") +
    hash.result().toString(16).padStart(8, "0");

  const date = new Date(timestamp * 1000);
  const day =
    date.getFullYear().toString() +
    "-" +
    (date.getMonth() + 1).toString().padStart(2, "0") +
    "-" +
    date.getDate().toString().padStart(2, "0");
  return { slug, day };
}
