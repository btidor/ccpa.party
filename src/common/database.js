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

export type TimelineEntryKey = {|
  +day: string,
  +timestamp: number,
  +slug: string,
  +category: string,
  +iv?: string,
  +offset?: number,
|};

export type TimelineContext =
  | null
  | [string]
  | [string, ?string]
  | [string, ?string, ?{| display: string, color: ?string |}];

export type TimelineEntry = {|
  ...TimelineEntryKey,
  +file: $ReadOnlyArray<string>,
  +context: TimelineContext,
  +value: { [string]: any },
|};

const dbName = "ccpa.party";
const dbVersion = 1;
const dbStore = "encrypted";

const dbInitLock = "ccpa.party/dbinit";
const dbWriteLock = "ccpa.party/dbwrite";

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
  timeline: Array<[string, number, string, number, string, string]>,
|};

type AsyncState = {| +db: IDBDatabase, +key: any |};

export class Database {
  _terminated: () => void;
  _state: Promise<?AsyncState>;
  _rootIndex: Promise<RootIndex>;

  constructor(terminated: () => void) {
    this._terminated = terminated;
    this._state = new Promise((resolve) => {
      // $FlowFixMe[prop-missing]
      if (!navigator.locks || !window.indexedDB || !window.crypto?.subtle) {
        console.error("Browser not supported:", [
          // $FlowFixMe[prop-missing]
          !!navigator.locks,
          !!window.indexedDB,
          !!window.crypto?.subtle,
        ]);
      } else {
        // $FlowFixMe[incompatible-use]
        navigator.locks.request(dbInitLock, async () =>
          resolve(await this._initializeState())
        );
      }
    });

    this._rootIndex = (async () =>
      (await this._get(rootIndexKey, { named: true })) || {})();
  }

  async _initializeState(): Promise<?AsyncState> {
    // Open and initialize our IndexedDB database.
    const db = await new Promise((resolve, reject) => {
      const op = window.indexedDB.open(dbName, dbVersion);
      op.onsuccess = () => {
        const db = op.result;
        db.onversionchange = () => (db.close(), this._terminated());
        db.onclose = () => this._terminated();
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

    // We encrypt the data and store the key in a cookie because (a) the browser
    // cookie jar is encrypted using OS-level data protection APIs while
    // IndexedDB is not, and (b) we can force the key to expire after 24 hours.
    const cookie = getCookie(keyCookie);
    let cookieHash, key;
    if (cookie) {
      key = await window.crypto.subtle.importKey(
        "raw",
        b64dec(cookie),
        "AES-GCM",
        false,
        keyUsages
      );
      cookieHash = b64enc(
        await window.crypto.subtle.digest("SHA-256", b64dec(cookie))
      );
    }

    const storedHash: string = await new Promise((resolve, reject) => {
      const op = db.transaction(dbStore).objectStore(dbStore).get(keyHashKey);
      op.onsuccess = () => resolve((op.result: any));
      op.onerror = (e) => reject(e);
    });
    if (storedHash && storedHash === cookieHash) {
      // Success! Database was created with the current encryption key.
      return { db, key };
    } else if (storedHash !== undefined) {
      // Database exists, but was created with an older enryption key.
      // Clear, then reload the page to reinitialize.
      console.warn("Clearing IndexedDB...");
      await new Promise((resolve, reject) => {
        const op = db
          .transaction(dbStore, "readwrite")
          .objectStore(dbStore)
          .clear();
        op.onsuccess = () => resolve(op.result);
        op.onerror = (e) => reject(e);
      });
      db.close();
      return await this._initializeState();
    } else {
      // Database is empty; generate a new key (unless in read-only mode)
      // and initialize it.
      if (await this._generateAndSaveKey(db)) {
        db.close();
        return await this._initializeState();
      } else {
        // Read-only database. Resolve with undefined state so operations
        // return empty results.
        return;
      }
    }
  }

  async _generateAndSaveKey(db: IDBDatabase): Promise<boolean> {
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
  _provider: Provider<any>;
  _providerIndex: Promise<ProviderIndex>;

  constructor(provider: Provider<any>, terminated: () => void) {
    super(terminated);
    this._provider = provider;
    this._providerIndex = (async () => {
      const iv = (await this._rootIndex)[provider.slug];
      return (
        (iv && (await this._get(iv))) || {
          files: [],
          metadata: [],
          timeline: [],
        }
      );
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
      ([iv, offset, day, timestamp, slug, category]) => ({
        day,
        timestamp,
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
      ([, , , , s]) => s === slug
    );
    if (!entry) return;
    const [iv, offset, day, timestamp, s, category] = entry;
    return this.hydrateTimelineEntry({
      day,
      timestamp,
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
    timelineDedup: Set<string>,
  |};

  constructor(provider: Provider<any>, terminated: () => void) {
    const release = new Promise((resolve) => {
      super(provider, () => (resolve(), terminated()));
      this._additions = {
        files: [],
        metadata: new Map(),
        timeline: [],
        timelineDedup: new Set(),
      };
    });
    // $FlowFixMe[prop-missing]
    navigator.locks.request(dbWriteLock, () => release);
  }

  async _generateAndSaveKey(db: IDBDatabase): Promise<boolean> {
    console.warn("Initializing IndexedDB...");
    const key = await window.crypto.getRandomValues(new Uint8Array(32));
    const keyHash = b64enc(await window.crypto.subtle.digest("SHA-256", key));

    setCookie(keyCookie, b64enc(key), keyMaxAge);
    await new Promise((resolve, reject) => {
      const op = db
        .transaction(dbStore, "readwrite")
        .objectStore(dbStore)
        .put(keyHash, keyHashKey);
      op.onsuccess = () => resolve(op.result);
      op.onerror = (e) => reject(e);
    });
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
        ...batch.map(({ day, timestamp, slug, category }, i) => [
          iv,
          i,
          day,
          timestamp,
          slug,
          category,
        ])
      );
    }
    timelineIndex.sort((a, b) => a[4].localeCompare(b[4]));

    // Write provider index
    const iv = await this._put({
      files: fileIndex,
      metadata: metadataIndex,
      timeline: timelineIndex,
    });

    // Update root index
    const root = await this._rootIndex;
    root[this._provider.slug] = iv;
    await this._put(root, rootIndexKey);

    // Close database and block future writes
    (await this._state)?.db.close();
    this._state = Promise.resolve();
    this._terminated();
  }

  async resetProvider(): Promise<void> {
    const deletes = new Set();

    // Delete data pages & provider index
    (await this.getFiles()).forEach((f) => deletes.add(f.iv));
    (await this.getTimelineEntries()).forEach((e) => deletes.add(e.iv));
    deletes.add((await this._rootIndex)[this._provider.slug]);
    deletes.delete(undefined);
    await this._deletes((deletes: any));

    // Update root index
    const root = await this._rootIndex;
    delete root[this._provider.slug];
    await this._put(root, rootIndexKey);

    // Close database and block future writes
    const isEmpty = !Object.keys(
      (await this._get(rootIndexKey, { named: true })) || {}
    ).length;
    const state = await this._state;
    if (isEmpty && state) {
      console.warn("Clearing IndexedDB...");
      await new Promise((resolve, reject) => {
        const op = state.db
          .transaction(dbStore, "readwrite")
          .objectStore(dbStore)
          .clear();
        op.onsuccess = () => resolve(op.result);
        op.onerror = (e) => reject(e);
      });
    }
    state?.db.close();
    this._state = Promise.resolve();
    this._terminated();
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

  async _deletes(keys: $ReadOnlySet<string>): Promise<void> {
    const state = await this._state;
    if (!state) throw new Error("Writing to closed database");
    const { db } = state;

    await new Promise((resolve, reject) => {
      const txn: IDBTransaction = db.transaction(dbStore, "readwrite");
      const store = txn.objectStore(dbStore);
      keys.forEach((k) => store.delete(k));

      txn.oncomplete = () => resolve();
      txn.onerror = (e) => reject(e);
    });
  }

  putFile(file: DataFile): void {
    this._additions.files.push(file);
  }

  putMetadata(metadata: Map<string, any>): void {
    metadata.forEach((v, k) => this._additions.metadata.set(k, v));
  }

  putTimelineEntry(entry: TimelineEntry): void {
    if (!this._additions.timelineDedup.has(entry.slug)) {
      this._additions.timeline.push(entry);
      this._additions.timelineDedup.add(entry.slug);
    }
  }
}
