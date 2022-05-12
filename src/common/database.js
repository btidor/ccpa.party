// @flow
import {
  b64enc,
  b64dec,
  serialize,
  deserialize,
  getCookie,
  setCookie,
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
  +offset?: number,
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

const keyCookie = "key";
const keyMaxAge = 24 * 3600; // 24 hours
const keyUsages = ["encrypt", "decrypt"];

const batchSize = 100;

type RootIndex = {| [string]: string |}; // provider slug -> iv

type ProviderIndex = {|
  files: Array<DataFileKey>,
  metadata: Array<[string, any]>,
  timeline: Array<[string, number, string, string, string]>,
|};

type AsyncState = {| +db: IDBDatabase, +key: any |};

export class Database {
  _state: Promise<?AsyncState>;
  _rootIndex: Promise<RootIndex>;

  constructor(terminated: ?() => void) {
    this._state = (async () => {
      // We encrypt the data and store the key in a cookie because (a) the browser
      // cookie jar is encrypted using OS-level data protection APIs while
      // IndexedDB is not, and (b) we can force the key to expire after 24 hours.
      const cookie = getCookie(keyCookie);
      if (cookie) {
        const key = await window.crypto.subtle.importKey(
          "raw",
          b64dec(cookie),
          "AES-GCM",
          false,
          keyUsages
        );
        const keyHash = b64enc(
          await window.crypto.subtle.digest("SHA-256", b64dec(cookie))
        );

        const db: IDBDatabase = await this._openDatabase(terminated);
        let storedHash: string = await new Promise((resolve, reject) => {
          const op = db
            .transaction(dbStore)
            .objectStore(dbStore)
            .get(keyHashKey);
          op.onsuccess = () => resolve((op.result: any));
          op.onerror = (e) => reject(e);
        });
        if (storedHash === keyHash) {
          // Success! Database was created with the current encryption key.
          return { db, key };
        } else {
          // Database exists, but was created with an older enryption key.
          // Close, then fall through to delete the database.
          db.close();
        }
      }

      await new Promise((resolve, reject) => {
        // Unfortunately, Firefox doesn't let us enumerate the existing
        // databases. This is a no-op if the database doesn't exist.
        const op = window.indexedDB.deleteDatabase(dbName);
        op.onsuccess = () => resolve(op.result);
        op.onerror = (e) => reject(e);
      });

      if (await this._generateAndSaveKey()) {
        console.error("Encryption key expired, clearing IndexedDB...");
      }
      terminated?.();
    })();

    this._rootIndex = (async () =>
      (await this._get(rootIndexKey, { named: true })) || {})();
  }

  _openDatabase(terminated: ?() => void): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const op = window.indexedDB.open(dbName, dbVersion);
      op.onsuccess = () => {
        const db = op.result;
        db.onversionchange = () => (db.close(), terminated?.());
        db.onclose = () => terminated?.();
        resolve(db);
      };
      op.onerror = (e) => reject(e);
      op.onupgradeneeded = () => {
        // For now, schema upgrades wipe the database
        const db = op.result;
        [...db.objectStoreNames].forEach((store) =>
          db.deleteObjectStore(store)
        );
        db.createObjectStore(dbStore);
      };
      op.onblocked = () => op.result.close();
    });
  }

  async _generateAndSaveKey(): Promise<boolean> {
    return false;
  }

  async _get(
    k: string,
    opts?: {| +binary?: boolean, +named?: boolean |}
  ): Promise<any> {
    const state = await this._state;
    if (!state) return; // failed to initialize, treat as empty database
    const { db, key } = state;

    let result: any = await new Promise((resolve, reject) => {
      const op = db.transaction(dbStore).objectStore(dbStore).get(k);
      op.onsuccess = () => resolve(op.result);
      op.onerror = (e) => reject(e);
    });
    if (result === undefined) return;

    const [iv, ciphertext] = opts?.named ? result : [b64dec(k), result];
    result = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
    if (!opts?.binary) result = deserialize(result);
    return result;
  }

  async getProviders(): Promise<Set<string>> {
    return new Set(Object.keys(await this._rootIndex));
  }
}

export class ProviderScopedDatabase extends Database {
  _provider: Provider;
  _providerIndex: Promise<ProviderIndex>;

  constructor(provider: Provider, terminated: ?() => void) {
    super(terminated);
    this._provider = provider;
    this._providerIndex = (async () => {
      const iv = (await this._rootIndex)[provider.slug];
      return (iv && this._get(iv)) || { files: [], metadata: [], timeline: [] };
    })();
  }

  async getFiles(): Promise<$ReadOnlyArray<DataFileKey>> {
    return (await this._providerIndex).files;
  }

  async hydrateFile(file: DataFileKey): Promise<?DataFile> {
    if (!file.iv) throw new Error("DataFileKey is missing IV");
    if (file.skipped) return { ...file, data: new ArrayBuffer(0) };
    const data = await this._get(file.iv, { binary: true });
    if (!data) return;
    return { ...file, data };
  }

  async getMetadata(): Promise<$ReadOnlyMap<string, any>> {
    return new Map((await this._providerIndex).metadata);
  }

  async getTimelineEntries(): Promise<Array<TimelineEntryKey>> {
    return (await this._providerIndex).timeline.map(
      ([iv, offset, day, slug, category]) => ({
        type: "timeline",
        provider: this._provider.slug,
        day,
        slug,
        category,
        iv,
        offset,
      })
    );
  }

  async hydrateTimelineEntry(entry: TimelineEntryKey): Promise<?TimelineEntry> {
    if (!entry.iv || entry.offset === undefined) {
      throw new Error("TimelineEntryKey is missing IV or offset");
    }
    const data = await this._get(entry.iv);
    if (!data) return;
    const [file, context, value] = data[entry.offset];
    return {
      ...entry,
      file,
      context,
      value,
    };
  }

  async getTimelineEntryBySlug(slug: string): Promise<?TimelineEntry> {
    const entry = (await this._providerIndex).timeline.find(
      ([, , , s]) => s === slug
    );
    if (!entry) return;
    const [iv, offset, day, s, category] = entry;
    return this.hydrateTimelineEntry({
      type: "timeline",
      provider: this._provider.slug,
      day,
      slug: s,
      category,
      iv,
      offset,
    });
  }
}

export class WritableDatabase extends ProviderScopedDatabase {
  _additions: {|
    files: Array<DataFile>,
    metadata: Map<string, any>,
    timeline: Array<TimelineEntry>,
  |};

  constructor(provider: Provider, terminated: ?() => void) {
    super(provider, terminated);
    this._additions = { files: [], metadata: new Map(), timeline: [] };
    // TODO: hold a lock while WritableDatabase is open
  }

  async _generateAndSaveKey(): Promise<boolean> {
    const db = await this._openDatabase();
    const key = await window.crypto.getRandomValues(new Uint8Array(32));
    const keyHash = b64enc(await window.crypto.subtle.digest("SHA-256", key));
    if (getCookie(keyCookie)) {
      // Data race! Don't write cookie, just reload.
    } else {
      setCookie(keyCookie, b64enc(key), keyMaxAge);
      await new Promise((resolve, reject) => {
        const op = db
          .transaction(dbStore, "readwrite")
          .objectStore(dbStore)
          .put(keyHash, keyHashKey);
        op.onsuccess = () => resolve(op.result);
        op.onerror = (e) => reject(e);
      });
    }
    db.close();
    return true;
  }

  // You MUST call `commit` in order to flush data and indexes.
  async commit(): Promise<void> {
    // Write files and compute index
    const fileIvs = await this._puts(
      this._additions.files.map(({ data }) => data),
      { binary: true }
    );
    const fileIndex = this._additions.files.map(({ data, ...rest }, i) => ({
      iv: fileIvs[i],
      ...rest,
    }));
    fileIndex.sort((a, b) => a.path.join().localeCompare(b.path.join()));

    // Compute metadata index
    const metadataIndex = [...this._additions.metadata];
    metadataIndex.sort();

    // Write timeline entries and compute index
    const timelineIndex = [];
    for (let i = 0; i < this._additions.timeline.length; i += batchSize) {
      const batch = this._additions.timeline.slice(i, i + batchSize);
      const iv = await this._put(
        batch.map(({ file, context, value }) => [file, context, value])
      );
      timelineIndex.push(
        ...batch.map(({ day, slug, category }, i) => [
          iv,
          i,
          day,
          slug,
          category,
        ])
      );
    }
    timelineIndex.sort((a, b) => a[3].localeCompare(b[3]));

    // Overwrite provider index
    const iv = await this._put({
      files: fileIndex,
      metadata: metadataIndex,
      timeline: timelineIndex,
    });

    // Write root index
    const root = await this._rootIndex;
    root[this._provider.slug] = iv;
    await this._put(root, rootIndexKey);

    // Close database and block future writes
    (await this._state)?.db.close();
    this._state = Promise.resolve();
  }

  async _put(v: any, k?: string): Promise<string> {
    const state = await this._state;
    if (!state) throw new Error("Writing to closed database");
    const { db, key } = state;

    const iv = await window.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      serialize(v)
    );

    const [dbkey, dbval] = k ? [k, [iv, ciphertext]] : [b64enc(iv), ciphertext];

    await new Promise((resolve, reject) => {
      const op = db
        .transaction(dbStore, "readwrite")
        .objectStore(dbStore)
        .put(dbval, dbkey);
      op.onsuccess = () => resolve();
      op.onerror = (e) => reject(e);
    });
    return dbkey;
  }

  async _puts(
    data: $ReadOnlyArray<any>,
    opts?: {| +binary?: boolean |}
  ): Promise<Array<string>> {
    const state = await this._state;
    if (!state) throw new Error("Writing to closed database");
    const { db, key } = state;

    if (!opts?.binary) data = data.map((v) => serialize(v));

    const [ciphertexts, ivs] = [[], []];
    for (let i = 0; i < data.length; i++) {
      const iv = await window.crypto.getRandomValues(new Uint8Array(12));
      ciphertexts.push(
        await window.crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          key,
          data[i]
        )
      );
      ivs.push(b64enc(iv));
    }

    await new Promise((resolve, reject) => {
      const txn: IDBTransaction = db.transaction(dbStore, "readwrite");
      const store = txn.objectStore(dbStore);
      ivs.map((iv, i) => store.put(ciphertexts[i], iv));

      txn.oncomplete = () => resolve();
      txn.onerror = (e) => reject(e);
    });
    return ivs;
  }

  async putFile(file: DataFile): Promise<void> {
    this._additions.files.push(file);
  }

  async putMetadata(metadata: MetadataEntry): Promise<void> {
    const { key, value } = metadata;
    this._additions.metadata.set(key, value);
  }

  async putTimelineEntry(entry: TimelineEntry): Promise<void> {
    this._additions.timeline.push(entry);
  }
}