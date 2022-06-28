import type { Provider } from "@src/common/provider";
import { b64dec, b64enc, deserialize, serialize } from "@src/common/util";

export type DataFileKey = {
  provider: string;
  path: ReadonlyArray<string>;
  slug: string; // hash of path
  skipped: "tooLarge" | void;
  iv?: string;
  status?: "parsed" | "skipped" | "unknown";
  errors: ParseError[];
};

export type DataFile = DataFileKey & { data: ArrayBufferLike };

export type ParseStage = "tokenize" | "parse" | "transform";

export type ParseError = {
  stage: ParseStage;
  message: string;
  line?: string;
};

export type TimelineEntryKey<T> = {
  day: string;
  timestamp: number;
  slug: string;
  category: T;
  iv?: string;
  offset?: number;
};

export type TimelineUser = { display: string; color?: string };

export type TimelineContext = null | [string, string?, TimelineUser?];

export type TimelineEntry<T> = TimelineEntryKey<T> & {
  file: ReadonlyArray<string>;
  context: TimelineContext;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
};

const dbName = "ccpa.party";
const dbVersion = 1;
const dbStore = "encrypted";

const dbInitLock = "ccpa.party/dbinit";
const dbWriteLock = "ccpa.party/dbwrite";

const keyHashKey = "KEY-HASH";
const rootIndexKey = "ROOT-INDEX";

const keyUsages: KeyUsage[] = ["encrypt", "decrypt"];

// Increasing the batch size adds latency and makes the timeline view sluggish
// (because we have to sift through more extraneous data in order to load the
// items we want), but it also speeds up imports by a lot, especially on older
// browsers (because the per-put overhead is so high). :(
const batchSize = 250;

type RootIndex = { [key: string]: string }; // provider slug -> iv

type ProviderIndex = {
  files: DataFileKey[];
  metadata: [string, unknown][];
  timeline: [string, number, string, number, string, string][];
  hasErrors: boolean;
};

type AsyncState = { db: IDBDatabase; key: CryptoKey };

export class Database {
  _terminated: () => void;
  _releaseLock?: () => void;
  _state: Promise<AsyncState | void>;
  _rootIndex: Promise<RootIndex>;

  constructor(key: ArrayBuffer | void, terminated: () => void) {
    this._terminated = terminated;
    this._state = new Promise((resolve) => {
      navigator.locks.request(dbInitLock, async () => {
        const db = await this._initializeState(key);
        // If there's an error (db is undefined), the _state promise should
        // never resolve so that database operations hang, but we should still
        // release the init lock (by exiting this block).
        db !== "error" && resolve(db);
      });
    });

    this._rootIndex = (async () =>
      ((await this._get(rootIndexKey, { named: true })) as RootIndex) || {})();
  }

  async _initializeState(
    keyBytes: ArrayBuffer | void
  ): Promise<AsyncState | "error" | void> {
    // Open and initialize our IndexedDB database.
    const db: IDBDatabase | void = await new Promise((resolve) => {
      const op = globalThis.indexedDB.open(dbName, dbVersion);
      op.onsuccess = () => {
        const db = op.result;
        db.onversionchange = () => (db.close(), this._terminate());
        db.onclose = () => this._terminate();
        resolve(db);
      };
      op.onerror = (e) => (
        console.error("Failed to open IndexedDB", e), resolve(undefined)
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
    let key, keyHash;
    if (keyBytes) {
      key = await globalThis.crypto.subtle.importKey(
        "raw",
        keyBytes,
        "AES-GCM",
        false,
        keyUsages
      );
      keyHash = b64enc(
        await globalThis.crypto.subtle.digest("SHA-256", keyBytes)
      );
    }

    const storedHash: string = await new Promise((resolve, reject) => {
      const op = db.transaction(dbStore).objectStore(dbStore).get(keyHashKey);
      op.onsuccess = () => resolve(op.result);
      op.onerror = (e) => reject(e);
    });
    if (storedHash === keyHash && key) {
      // Success! Database was created with the current encryption key.
      return { db, key };
    } else if (key && keyBytes) {
      // TODO: handle key mismatch

      // Database is empty; initialize it.
      console.warn("Initializing IndexedDB...");
      const keyHash = b64enc(
        await globalThis.crypto.subtle.digest("SHA-256", keyBytes)
      );
      await new Promise((resolve, reject) => {
        const op = db
          .transaction(dbStore, "readwrite")
          .objectStore(dbStore)
          .put(keyHash, keyHashKey);
        op.onsuccess = () => resolve(op.result);
        op.onerror = (e) => reject(e);
      });
      db.close();
      return await this._initializeState();
    } else {
      // Read-only database. Resolve with undefined state so operations
      // return empty results.
      return;
    }
  }

  async _terminate(): Promise<void> {
    if (this._releaseLock) await this._releaseLock();
    this._terminated();
  }

  async _get(
    k: string,
    opts?: { binary?: boolean; named?: boolean }
  ): Promise<unknown> {
    const state = await this._state;
    if (!state) return; // failed to initialize, treat as empty database
    const { db, key } = state;

    const result = await new Promise((resolve, reject) => {
      const op = db.transaction(dbStore).objectStore(dbStore).get(k);
      op.onsuccess = () => resolve(op.result);
      op.onerror = (e) => reject(e);
    });
    if (result === undefined) return;

    const [iv, ciphertext] = opts?.named
      ? (result as [ArrayBufferLike, ArrayBufferLike])
      : [b64dec(k), result as ArrayBufferLike];
    const plaintext = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
    if (!opts?.binary) return deserialize(plaintext);
    return plaintext;
  }

  async getProviders(): Promise<Set<string>> {
    return new Set(Object.keys(await this._rootIndex));
  }
}

export class ProviderScopedDatabase<T> extends Database {
  _provider: Provider<T>;
  _providerIndex: Promise<ProviderIndex>;

  constructor(
    key: ArrayBuffer | void,
    provider: Provider<T>,
    terminated: () => void
  ) {
    super(key, terminated);
    this._provider = provider;
    this._providerIndex = (async () => {
      const iv = (await this._rootIndex)[provider.slug];
      return ((iv && (await this._get(iv))) || {
        files: [],
        metadata: [],
        timeline: [],
        hasErrors: false,
      }) as ProviderIndex;
    })();
  }

  async getHasErrors(): Promise<boolean> {
    return (await this._providerIndex).hasErrors;
  }

  async getFiles(): Promise<ReadonlyArray<DataFileKey>> {
    return (await this._providerIndex).files;
  }

  async hydrateFile(file: DataFileKey): Promise<DataFile | undefined> {
    if (!file.iv) throw new Error("DataFileKey is missing IV");
    if (file.skipped) return { ...file, data: new ArrayBuffer(0) };
    const data = (await this._get(file.iv, {
      binary: true,
    })) as ArrayBufferLike | void;
    if (!data) return;
    return { ...file, data };
  }

  async getMetadata(): Promise<ReadonlyMap<string, unknown>> {
    return new Map((await this._providerIndex).metadata);
  }

  async getTimelineEntries(): Promise<TimelineEntryKey<T>[]> {
    return (await this._providerIndex).timeline.map(
      ([iv, offset, day, timestamp, slug, category]) => ({
        day,
        timestamp,
        slug,
        category: category as unknown as T,
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
    const data = (await this._get(entry.iv)) as [
      string[],
      TimelineContext,
      { [key: string]: unknown }
    ][];
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
      category: category as unknown as T,
      iv,
      offset,
    });
  }
}

export class WritableDatabase<T> extends ProviderScopedDatabase<T> {
  _additions: {
    files: DataFile[];
    metadata: Map<string, unknown>;
    timeline: TimelineEntry<T>[];
    timelineDedup: Set<string>;
  };

  constructor(
    key: ArrayBuffer | void,
    provider: Provider<T>,
    terminated: () => void
  ) {
    super(key, provider, terminated);
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
      hasErrors: this._additions.files.some((file) => file.errors.length),
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
      ((await this._get(rootIndexKey, { named: true })) as RootIndex) || {}
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

  async _put(v: unknown, k?: string): Promise<string> {
    const state = await this._state;
    if (!state) throw new Error("Writing to closed database");
    const { db, key } = state;

    const iv = await globalThis.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await globalThis.crypto.subtle.encrypt(
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
    data: ReadonlyArray<unknown>,
    opts?: { binary: false }
  ): Promise<string[]>;
  async _puts(
    data: ReadonlyArray<ArrayBufferLike>,
    opts: { binary: true }
  ): Promise<string[]>;
  async _puts(
    data: ReadonlyArray<unknown>,
    opts?: { binary?: boolean }
  ): Promise<string[]> {
    const state = await this._state;
    if (!state) throw new Error("Writing to closed database");
    const { db, key } = state;

    if (!opts?.binary) data = data.map((v) => serialize(v));

    const ciphertexts: ArrayBufferLike[] = [];
    const ivs: string[] = [];
    for (let i = 0; i < data.length; i++) {
      const iv = await globalThis.crypto.getRandomValues(new Uint8Array(12));
      ciphertexts.push(
        await globalThis.crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          key,
          data[i] as ArrayBufferLike
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

  putMetadata(metadata: Map<string, unknown>): void {
    metadata.forEach((v, k) => this._additions.metadata.set(k, v));
  }

  putTimelineEntry(entry: TimelineEntry<T>): void {
    if (!this._additions.timelineDedup.has(entry.slug)) {
      this._additions.timeline.push(entry);
      this._additions.timelineDedup.add(entry.slug);
    }
  }
}
