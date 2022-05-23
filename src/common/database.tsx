import type { Provider } from "@src/common/provider";
import {
  b64dec,
  b64enc,
  deserialize,
  getCookie,
  serialize,
  setCookie,
} from "@src/common/util";

export type DataFileKey = {
  provider: string;
  path: ReadonlyArray<string>;
  skipped: "tooLarge" | void;
  iv?: string;
};

export type DataFile = DataFileKey & { data: ArrayBufferLike };

export type TimelineEntryKey<T> = {
  day: string;
  timestamp: number;
  slug: string;
  category: T;
  iv?: string;
  offset?: number;
};

export type TimelineContext =
  | null
  | [string]
  | [string, string | void]
  | [string, string | void, { display: string; color?: string } | void];

export type TimelineEntry<T> = TimelineEntryKey<T> & {
  file: ReadonlyArray<string>;
  context: TimelineContext;
  value: { [key: string]: any };
};

const dbName = "ccpa.party";
const dbVersion = 1;
const dbStore = "encrypted";

const dbInitLock = "ccpa.party/dbinit";
const dbWriteLock = "ccpa.party/dbwrite";

const keyHashKey = "KEY-HASH";
const rootIndexKey = "ROOT-INDEX";

const keyCookie = "key";
const keyMaxAge = 24 * 3600; // 24 hours
const keyUsages: KeyUsage[] = ["encrypt", "decrypt"];

// Increasing the batch size adds latency and makes the timeline view sluggish
// (because we have to sift through more extraneous data in order to load the
// items we want), but it also speeds up imports by a lot, especially on older
// browsers (because the per-put overhead is so high). :(
const batchSize = 250;

type RootIndex = { [key: string]: string }; // provider slug -> iv

type ProviderIndex = {
  files: Array<DataFileKey>;
  metadata: Array<[string, any]>;
  timeline: Array<[string, number, string, number, string, string]>;
  errors?: number;
};

type AsyncState = { db: IDBDatabase; key: any };

export class Database {
  _terminated: () => void;
  _releaseLock?: () => void;
  _errored?: () => void;
  _state: Promise<AsyncState | void>;
  _rootIndex: Promise<RootIndex>;

  constructor(terminated: () => void, errored?: () => void) {
    this._terminated = terminated;
    this._errored = errored;
    this._state = new Promise((resolve) => {
      const support = [
        !!navigator.locks,
        !!window.indexedDB,
        !!window.crypto?.subtle,
      ];
      if (!support.every((x) => x)) {
        console.error("Browser not supported:", support);
        errored?.();
      } else {
        navigator.locks.request(dbInitLock, async () => {
          const db = await this._initializeState();
          // If there's an error (db is undefined), the _state promise should
          // never resolve so that database operations hang, but we should still
          // release the init lock (by exiting this block).
          db !== "error" && resolve(db);
        });
      }
    });

    this._rootIndex = (async () =>
      (await this._get(rootIndexKey, { named: true })) || {})();
  }

  async _initializeState(): Promise<AsyncState | "error" | void> {
    // Open and initialize our IndexedDB database.
    const db: IDBDatabase | void = await new Promise((resolve) => {
      const op = window.indexedDB.open(dbName, dbVersion);
      op.onsuccess = () => {
        const db = op.result;
        db.onversionchange = () => (db.close(), this._terminate());
        db.onclose = () => this._terminate();
        resolve(db);
      };
      // This usually means we're in a Firefox private window, so no IndexedDB:
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1639542
      op.onerror = (e) => (
        console.error("Failed to open IndexedDB", e, this._errored),
        this._errored?.(),
        resolve(undefined)
      );
      op.onupgradeneeded = () => {
        // For now, schema upgrades wipe the database
        const db = op.result;
        Array.from(db.objectStoreNames).forEach((store) =>
          db.deleteObjectStore(store)
        );
        db.createObjectStore(dbStore);
      };
      op.onblocked = () => op.result.close();
    });
    if (!db) return "error";

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
      op.onsuccess = () => resolve(op.result);
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

  async _terminate(): Promise<void> {
    if (this._releaseLock) await this._releaseLock();
    this._terminated();
  }

  async _get(
    k: string,
    opts?: { binary?: boolean; named?: boolean }
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

export class ProviderScopedDatabase<T> extends Database {
  _provider: Provider<T>;
  _providerIndex: Promise<ProviderIndex>;

  constructor(
    provider: Provider<T>,
    terminated: () => void,
    errored?: () => void
  ) {
    super(terminated, errored);
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

  async getErrors(): Promise<number> {
    return (await this._providerIndex).errors || 0;
  }

  async getFiles(): Promise<ReadonlyArray<DataFileKey>> {
    return (await this._providerIndex).files;
  }

  async hydrateFile(file: DataFileKey): Promise<DataFile | undefined> {
    if (!file.iv) throw new Error("DataFileKey is missing IV");
    if (file.skipped) return { ...file, data: new ArrayBuffer(0) };
    const data = await this._get(file.iv, { binary: true });
    if (!data) return;
    return { ...file, data };
  }

  async getMetadata(): Promise<ReadonlyMap<string, any>> {
    return new Map((await this._providerIndex).metadata);
  }

  async getTimelineEntries(): Promise<Array<TimelineEntryKey<T>>> {
    return (await this._providerIndex).timeline.map(
      ([iv, offset, day, timestamp, slug, category]) => ({
        day,
        timestamp,
        slug,
        category: category as any,
        iv,
        offset,
      })
    );
  }

  async hydrateTimelineEntry(
    entry: TimelineEntryKey<T>
  ): Promise<TimelineEntry<T> | void> {
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

  async getTimelineEntryBySlug(slug: string): Promise<TimelineEntry<T> | void> {
    const entry = (await this._providerIndex).timeline.find(
      ([, , , , s]) => s === slug
    );
    if (!entry) return;
    const [iv, offset, day, timestamp, s, category] = entry;
    return this.hydrateTimelineEntry({
      day,
      timestamp,
      slug: s,
      category: category as any,
      iv,
      offset,
    });
  }
}

export class WritableDatabase<T> extends ProviderScopedDatabase<T> {
  _additions: {
    files: Array<DataFile>;
    metadata: Map<string, any>;
    timeline: Array<TimelineEntry<T>>;
    timelineDedup: Set<string>;
  };

  constructor(provider: Provider<T>, terminated: () => void) {
    super(provider, terminated);
    this._additions = {
      files: [],
      metadata: new Map(),
      timeline: [],
      timelineDedup: new Set(),
    };
    const release = new Promise<void>(
      (resolve) => (this._releaseLock = resolve)
    );
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
  async commit(errors: number): Promise<void> {
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
    const metadataIndex = Array.from(this._additions.metadata);
    metadataIndex.sort();

    // Write timeline entries and compute index
    const workingIndex: [string | void, number, string, number, string, T][][] =
      [];
    const writeQueue = [];
    for (let i = 0; i < this._additions.timeline.length; i += batchSize) {
      const batch = this._additions.timeline.slice(i, i + batchSize);
      writeQueue.push(
        batch.map(({ file, context, value }) => [file, context, value])
      );
      workingIndex.push(
        batch.map(({ day, timestamp, slug, category }, i) => [
          undefined,
          i,
          day,
          timestamp,
          slug,
          category,
        ])
      );
    }
    const ivs = await this._puts(writeQueue);
    for (let i = 0; i < ivs.length; i++) {
      workingIndex[i].forEach((row) => (row[0] = ivs[i]));
    }
    const timelineIndex = workingIndex.flat(1);
    timelineIndex.sort((a, b) => a[4].localeCompare(b[4]));

    // Write provider index
    const iv = await this._put({
      files: fileIndex,
      metadata: metadataIndex,
      timeline: timelineIndex,
      errors,
    });

    // Update root index
    const root = await this._rootIndex;
    root[this._provider.slug] = iv;
    await this._put(root, rootIndexKey);

    // Close database and block future writes
    (await this._state)?.db.close();
    this._state = Promise.resolve();
    this._terminate();
  }

  async resetProvider(): Promise<void> {
    const deletes = new Set<string | void>();

    // Delete data pages & provider index
    (await this.getFiles()).forEach((f) => deletes.add(f.iv));
    (await this.getTimelineEntries()).forEach((e) => deletes.add(e.iv));
    deletes.add((await this._rootIndex)[this._provider.slug]);
    deletes.delete(undefined);
    await this._deletes(deletes as Set<string>);

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
    this._terminate();
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

    await new Promise<void>((resolve, reject) => {
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
    data: ReadonlyArray<any>,
    opts?: { binary?: boolean }
  ): Promise<Array<string>> {
    const state = await this._state;
    if (!state) throw new Error("Writing to closed database");
    const { db, key } = state;

    if (!opts?.binary) data = data.map((v) => serialize(v));

    const [ciphertexts, ivs]: [ArrayBufferLike[], string[]] = [[], []];
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

    await new Promise<void>((resolve, reject) => {
      const txn: IDBTransaction = db.transaction(dbStore, "readwrite");
      const store = txn.objectStore(dbStore);
      ivs.map((iv, i) => store.put(ciphertexts[i], iv));

      txn.oncomplete = () => resolve();
      txn.onerror = (e) => reject(e);
    });
    return ivs;
  }

  async _deletes(keys: ReadonlySet<string>): Promise<void> {
    const state = await this._state;
    if (!state) throw new Error("Writing to closed database");
    const { db } = state;

    await new Promise<void>((resolve, reject) => {
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

  putTimelineEntry(entry: TimelineEntry<T>): void {
    if (!this._additions.timelineDedup.has(entry.slug)) {
      this._additions.timeline.push(entry);
      this._additions.timelineDedup.add(entry.slug);
    }
  }
}
