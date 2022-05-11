// @flow
import { deleteDB, openDB } from "idb";

import {
  b64enc,
  b64dec,
  serialize,
  deserialize,
  getOrSetCookie,
} from "common/util";

import type { Provider } from "common/provider";

export type DataFileKey = {|
  +provider: string,
  +path: $ReadOnlyArray<string>,
  +skipped: "tooLarge" | void,
  +iv?: string,
|};

export type DataFile = {| ...DataFileKey, +data: BufferSource |};

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
  +iv?: string,
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
const rootIndexKey = "ROOT-INDEX";

const keyMaxAge = 24 * 3600; // 24 hours
const keyUsages = ["encrypt", "decrypt"];

type RootIndex = {| [string]: string |}; // provider slug -> iv

type ProviderIndex = {|
  files: Array<DataFileKey>,
  metadata: Array<[string, any]>,
  timeline: Array<[string, string, string, string]>,
|};

export class Database {
  _idb: Promise<any>;
  _key: Promise<any>;

  constructor(terminated: ?() => void) {
    const idb = openDB(dbName, dbVersion, {
      async upgrade(db) {
        // For now, schema upgrades wipe the database
        [...db.objectStoreNames].forEach((store) =>
          db.deleteObjectStore(store)
        );
        db.createObjectStore(dbStore);
      },
      async blocking() {
        (await idb).close();
        terminated?.();
      },
      async terminated() {
        terminated?.();
      },
    });
    this._idb = idb;

    // We encrypt the data and store the key in a cookie because (a) the browser
    // cookie jar is encrypted using OS-level data protection APIs while
    // IndexedDB is not, and (b) we can force the key to expire after 24 hours.
    this._key = getOrSetCookie("key", async () => {
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
        this._idb.then((db) =>
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

  async _getRootIndex(): Promise<RootIndex> {
    const db = await this._idb;
    const raw = await db.get(dbStore, rootIndexKey);
    if (!raw) return {};

    const [iv, ciphertext] = raw;
    const plaintext = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await this._key,
      ciphertext
    );
    return deserialize(plaintext);
  }

  async _getIndex(provider: string): Promise<ProviderIndex> {
    const iv = (await this._getRootIndex())[provider];
    if (iv) {
      const blob = await this._getBlob(iv);
      if (blob) return deserialize(blob);
    }
    return { files: [], metadata: [], timeline: [] };
  }

  async _getBlob(iv: string): Promise<?BufferSource> {
    const db = await this._idb;
    const ciphertext = await db.get(dbStore, iv);
    if (!ciphertext) return;
    return await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64dec(iv) },
      await this._key,
      ciphertext
    );
  }

  async getProviders(): Promise<Set<string>> {
    return new Set(Object.keys(await this._getRootIndex()));
  }

  async getFilesForProvider(
    provider: Provider
  ): Promise<$ReadOnlyArray<DataFileKey>> {
    return (await this._getIndex(provider.slug)).files;
  }

  async hydrateFile(file: DataFileKey): Promise<?DataFile> {
    if (!file.iv) throw new Error("DataFileKey is missing IV");
    if (file.skipped) return { ...file, data: new ArrayBuffer(0) };
    const data = await this._getBlob(file.iv);
    if (!data) return;
    return { ...file, data };
  }

  async getMetadatasForProvider(
    provider: Provider
  ): Promise<$ReadOnlyMap<string, any>> {
    return new Map((await this._getIndex(provider.slug)).metadata);
  }

  async getTimelineEntriesForProvider(
    provider: Provider
  ): Promise<Array<TimelineEntryKey>> {
    return (await this._getIndex(provider.slug)).timeline.map(
      ([iv, day, slug, category]) => ({
        type: "timeline",
        provider: provider.slug,
        day,
        slug,
        category,
        iv,
      })
    );
  }

  async hydrateTimelineEntry(entry: TimelineEntryKey): Promise<?TimelineEntry> {
    if (!entry.iv) throw new Error("TimelineEntryKey is missing IV");
    const data = await this._getBlob(entry.iv);
    if (!data) return;
    const [file, context, value] = deserialize(data);
    return {
      ...entry,
      file,
      context,
      value,
    };
  }

  async getTimelineEntryBySlug(
    provider: Provider,
    slug: string
  ): Promise<?TimelineEntry> {
    const entry = (await this._getIndex(provider.slug)).timeline.find(
      ([, , s]) => s === slug
    );
    if (!entry) return;
    const [iv, day, s, category] = entry;
    return this.hydrateTimelineEntry({
      type: "timeline",
      provider: provider.slug,
      day,
      slug: s,
      category,
      iv,
    });
  }
}

export class WritableDatabase extends Database {
  // TODO: hold a lock when writing to database

  _provider: Provider;
  _additions: {|
    files: Array<DataFileKey>,
    metadata: Array<[string, any]>,
    timeline: Array<[string, string, string, string]>,
  |};

  constructor(provider: Provider, terminated: ?() => void) {
    super(terminated);
    this._provider = provider;
    this._additions = { files: [], metadata: [], timeline: [] };
  }

  // You MUST call `commit` in order to flush indexes and metadata.
  async commit(): Promise<void> {
    // Overwrite provider index
    this._additions.files.sort((a, b) =>
      a.path.join().localeCompare(b.path.join())
    );
    this._additions.metadata = [...new Map(this._additions.metadata)];
    this._additions.metadata.sort();
    this._additions.timeline.sort((a, b) => a[2].localeCompare(b[2]));
    const ivProvider = await this._putBlob(serialize(this._additions));

    // Write root index
    const root = await this._getRootIndex();
    const prev = root[this._provider.slug];
    root[this._provider.slug] = ivProvider;

    const iv = await window.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await this._key,
      serialize(root)
    );
    const db = await this._idb;
    await db.put(dbStore, [iv, ciphertext], rootIndexKey);

    // Delete previous provider index
    if (prev) await db.delete(dbStore, prev);

    db.close();
  }

  async _putBlob(blob: BufferSource): Promise<string> {
    const iv = await window.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await this._key,
      blob
    );
    const key = b64enc(iv);
    const db = await this._idb;
    await db.put(dbStore, ciphertext, key);
    return key;
  }

  async putFile(file: DataFile): Promise<void> {
    const { data, ...rest } = file;
    const iv = await this._putBlob(file.data);
    this._additions.files.push({ iv, ...rest });
  }

  async putMetadata(metadata: MetadataEntry): Promise<void> {
    const { key, value } = metadata;
    this._additions.metadata.push([key, value]);
  }

  async putTimelineEntry(entry: TimelineEntry): Promise<void> {
    const { day, slug, category, file, context, value } = entry;
    const iv = await this._putBlob(serialize([file, context, value]));
    this._additions.timeline.push([iv, day, slug, category]);
  }
}
