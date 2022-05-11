//@flow
import { deleteDB, openDB } from "idb";

import { b64enc, b64dec, getOrSetCookie } from "common/util";

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

const dbName = "ccpa.party";
const dbVersion = 1;
const dbStore = "encrypted";

const keyHashKey = "KEY-HASH";

const keyMaxAge = 24 * 3600; // 24 hours
const keyUsages = ["encrypt", "decrypt"];

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
  #key: Promise<any>;

  constructor(terminated: ?() => void) {
    this.#idb = openDB(dbName, dbVersion, {
      async upgrade(db) {
        // For now, schema upgrades wipe the database
        [...db.objectStoreNames].forEach((store) =>
          db.deleteObjectStore(store)
        );
        db.createObjectStore(dbStore);
      },
      async terminated(db) {
        terminated?.();
      },
    });

    this.#enc = new TextEncoder();
    this.#dec = new TextDecoder();

    // We encrypt the data and store the key in a cookie because (a) the browser
    // cookie jar is encrypted using OS-level data protection APIs while
    // IndexedDB is not, and (b) we can force the key to expire after 24 hours.
    this.#key = getOrSetCookie("key", async () => {
      const key = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        keyUsages
      );
      const value = b64enc(await window.crypto.subtle.exportKey("raw", key));
      return [value, keyMaxAge];
    }).then((val) => {
      const key = window.crypto.subtle.importKey(
        "raw",
        b64dec(val),
        "AES-GCM",
        true,
        keyUsages
      );
      return window.crypto.subtle.digest("SHA-256", b64dec(val)).then((_hash) =>
        this.#idb.then((db) =>
          db.get(dbStore, keyHashKey).then((res) => {
            const hash = b64enc(_hash);
            if (res === hash) {
              return key;
            } else if (!res) {
              return db.put(dbStore, hash, keyHashKey).then(() => key);
            } else {
              console.error("Encryption key expired, clearing IndexedDB...");
              db.close();
              return deleteDB(dbName).then(() => terminated?.());
            }
          })
        )
      );
    });
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
