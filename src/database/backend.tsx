import { b64dec, b64enc, deserialize, serialize } from "@src/common/util";

const dbName = "ccpa.party";
const dbVersion = 1;
const dbStore = "encrypted";

// TODO: locking, potentially scoped by provider (but make sure to avoid
// initialization races)

const keyHashKey = "KEY-HASH";
const rootIndexKey = "ROOT-INDEX";

const keyUsages: KeyUsage[] = ["encrypt", "decrypt"];

export const channelId = "database";
export type DatabaseBroadcast =
  | { type: "reset" }
  | { type: "write"; provider: string };

const dbChannel = new BroadcastChannel(channelId);

export type RootIndex = { [key: string]: string }; // provider slug -> iv

export class ReadBackend {
  protected db: IDBDatabase;
  protected key: CryptoKey;
  reload: () => Promise<void>;

  protected constructor(
    db: IDBDatabase,
    key: CryptoKey,
    reload: () => Promise<void>
  ) {
    db.onversionchange = () => (db.close(), reload());
    db.onclose = () => reload();

    this.db = db;
    this.key = key;
    this.reload = reload;
  }

  static async connect(
    key: ArrayBuffer,
    reload: () => Promise<void>
  ): Promise<ReadBackend | void> {
    const db = await this.dbInit();
    const cryptoKey = await this.keyInit(db, key);
    return cryptoKey && new this(db, cryptoKey, reload);
  }

  protected static async dbInit(): Promise<IDBDatabase> {
    // Open and initialize IndexedDB database.
    return await new Promise<IDBDatabase>((resolve, reject) => {
      const op = globalThis.indexedDB.open(dbName, dbVersion);
      op.onsuccess = () => resolve(op.result);
      op.onerror = (e) => reject(e);
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
  }

  protected static async keyInit(
    db: IDBDatabase,
    key: ArrayBuffer
  ): Promise<CryptoKey | void> {
    // We encrypt the data and store the key in a cookie because (a) the browser
    // cookie jar is encrypted using OS-level data protection APIs while
    // IndexedDB is not, and (b) we can force the key to expire after 24 hours.
    const keyHash = await globalThis.crypto.subtle.digest("SHA-256", key);
    const storedHash: string = await new Promise((resolve, reject) => {
      const op = db.transaction(dbStore).objectStore(dbStore).get(keyHashKey);
      op.onsuccess = () => resolve(op.result);
      op.onerror = (e) => reject(e);
    });
    if (storedHash === b64enc(keyHash)) {
      // Success! Database was created with the current encryption key.
      return await globalThis.crypto.subtle.importKey(
        "raw",
        key,
        "AES-GCM",
        false,
        keyUsages
      );
    } else {
      // Database has not yet been initialized or written to, or database exists
      // but the original encryption key has expired.
      return undefined;
    }
  }

  async get(
    k: string,
    opts?: { binary?: boolean; named?: boolean }
  ): Promise<unknown> {
    const result = await new Promise((resolve, reject) => {
      const op = this.db.transaction(dbStore).objectStore(dbStore).get(k);
      op.onsuccess = () => resolve(op.result);
      op.onerror = (e) => reject(e);
    });
    if (result === undefined) return;

    const [iv, ciphertext] = opts?.named
      ? (result as [ArrayBufferLike, ArrayBufferLike])
      : [b64dec(k), result as ArrayBufferLike];
    const plaintext = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      this.key,
      ciphertext
    );
    if (!opts?.binary) return deserialize(plaintext);
    return plaintext;
  }

  async getRootIndex(): Promise<RootIndex> {
    const index = await this.get(rootIndexKey, { named: true });
    return index ? (index as RootIndex) : {};
  }
}

export class WriteBackend extends ReadBackend {
  static async connect(
    key: ArrayBuffer,
    reload: () => Promise<void>
  ): Promise<WriteBackend> {
    const db = await this.dbInit();
    const cryptoKey = await this.keyInit(db, key);
    return new this(db, cryptoKey, reload);
  }

  protected static async keyInit(
    db: IDBDatabase,
    key: ArrayBuffer
  ): Promise<CryptoKey> {
    // We encrypt the data and store the key in a cookie because (a) the browser
    // cookie jar is encrypted using OS-level data protection APIs while
    // IndexedDB is not, and (b) we can force the key to expire after 24 hours.
    const keyHash = await globalThis.crypto.subtle.digest("SHA-256", key);
    const storedHash: string = await new Promise((resolve, reject) => {
      const op = db.transaction(dbStore).objectStore(dbStore).get(keyHashKey);
      op.onsuccess = () => resolve(op.result);
      op.onerror = (e) => reject(e);
    });

    if (storedHash === b64enc(keyHash)) {
      // Success! Database was created with the current encryption key.
    } else if (storedHash === undefined) {
      // Database has not yet been initialized or written to. Set our encryption
      // key! Then trigger a reset, since some clients may have the old key
      // cached. (Note that writers typically do not reset, so make sure this
      // WriteBackend is still usable.)
      await new Promise<void>((resolve, reject) => {
        const op = db
          .transaction(dbStore, "readwrite")
          .objectStore(dbStore)
          .put(b64enc(keyHash), keyHashKey);
        op.onsuccess = () => resolve();
        op.onerror = (e) => reject(e);
      });
      this.broadcastReset();
    } else {
      // Database exists but the original encryption key has expired. We got
      // unlucky; the reset process [TODO] should have cleaned it up by now...
      throw new Error(
        "writing to database created under old encryption key..."
      );
    }

    return await globalThis.crypto.subtle.importKey(
      "raw",
      key,
      "AES-GCM",
      false,
      keyUsages
    );
  }

  static broadcastReset() {
    dbChannel.postMessage({ type: "reset" } as DatabaseBroadcast);
  }

  static broadcastWrite(provider: string) {
    dbChannel.postMessage({ type: "write", provider } as DatabaseBroadcast);
  }

  async put(v: unknown, k?: string): Promise<string> {
    const iv = await globalThis.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      this.key,
      serialize(v)
    );

    const [dbkey, dbval] = k ? [k, [iv, ciphertext]] : [b64enc(iv), ciphertext];

    await new Promise<void>((resolve, reject) => {
      const op = this.db
        .transaction(dbStore, "readwrite")
        .objectStore(dbStore)
        .put(dbval, dbkey);
      op.onsuccess = () => resolve();
      op.onerror = (e) => reject(e);
    });
    return dbkey;
  }

  async puts(
    data: ReadonlyArray<unknown>,
    opts?: { binary: false }
  ): Promise<string[]>;
  async puts(
    data: ReadonlyArray<ArrayBufferLike>,
    opts: { binary: true }
  ): Promise<string[]>;
  async puts(
    data: ReadonlyArray<unknown>,
    opts?: { binary?: boolean }
  ): Promise<string[]> {
    if (!opts?.binary) data = data.map((v) => serialize(v));

    const ciphertexts: ArrayBufferLike[] = [];
    const ivs: string[] = [];
    for (let i = 0; i < data.length; i++) {
      const iv = await globalThis.crypto.getRandomValues(new Uint8Array(12));
      ciphertexts.push(
        await globalThis.crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          this.key,
          data[i] as ArrayBufferLike
        )
      );
      ivs.push(b64enc(iv));
    }

    await new Promise<void>((resolve, reject) => {
      const txn: IDBTransaction = this.db.transaction(dbStore, "readwrite");
      const store = txn.objectStore(dbStore);
      ivs.map((iv, i) => store.put(ciphertexts[i], iv));

      txn.oncomplete = () => resolve();
      txn.onerror = (e) => reject(e);
    });
    return ivs;
  }

  async deletes(keys: ReadonlySet<string>): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const txn: IDBTransaction = this.db.transaction(dbStore, "readwrite");
      const store = txn.objectStore(dbStore);
      keys.forEach((k) => store.delete(k));

      txn.oncomplete = () => resolve();
      txn.onerror = (e) => reject(e);
    });
  }

  async updateRootIndex(update: (index: RootIndex) => void): Promise<void> {
    const index = await this.getRootIndex();
    update(index);
    this.put(index, rootIndexKey);
  }

  async clear(): Promise<void> {
    await new Promise((resolve, reject) => {
      const op = this.db
        .transaction(dbStore, "readwrite")
        .objectStore(dbStore)
        .clear();
      op.onsuccess = () => resolve(op.result);
      op.onerror = (e) => reject(e);
    });
  }
}
