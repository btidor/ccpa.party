import { b64dec, b64enc, deserialize, serialize } from "@src/common/util";
import { DatabaseRecord } from "@src/database/types";

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
  | { type: "rekey"; clear: string | void }
  | { type: "reset" }
  | { type: "write"; provider: string };

let dbChannel: BroadcastChannel | void;

function broadcast(msg: DatabaseBroadcast): void {
  dbChannel ||= new BroadcastChannel(channelId);
  dbChannel.postMessage(msg);
}

export type RootIndex = { [key: string]: string }; // provider slug -> iv

async function dbInit(): Promise<IDBDatabase> {
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

export class ReadBackend {
  protected db: IDBDatabase;
  protected key: CryptoKey;
  protected keyHash: string;
  reload: () => Promise<void>;

  protected constructor(
    db: IDBDatabase,
    key: CryptoKey,
    keyHash: string,
    reload: () => Promise<void>
  ) {
    db.onversionchange = () => (db.close(), reload());
    db.onclose = () => reload();

    this.db = db;
    this.key = key;
    this.keyHash = keyHash;
    this.reload = reload;
  }

  static async connect(
    key: ArrayBuffer,
    reload: () => Promise<void>
  ): Promise<ReadBackend | void> {
    const db = await dbInit();

    // We encrypt the data and store the key in a cookie because (a) the browser
    // cookie jar is encrypted using OS-level data protection APIs while
    // IndexedDB is not, and (b) we can force the key to expire after 24 hours.
    const keyHash = b64enc(
      await globalThis.crypto.subtle.digest("SHA-256", key)
    );
    const storedHash: string = await new Promise((resolve, reject) => {
      const op = db.transaction(dbStore).objectStore(dbStore).get(keyHashKey);
      op.onsuccess = () => resolve(op.result);
      op.onerror = (e) => reject(e);
    });
    if (storedHash === keyHash) {
      // Success! Database was created with the current encryption key.
      const cryptoKey = await globalThis.crypto.subtle.importKey(
        "raw",
        key,
        "AES-GCM",
        false,
        keyUsages
      );
      return new this(db, cryptoKey, keyHash, reload);
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
    const db = await dbInit();

    // We encrypt the data and store the key in a cookie because (a) the browser
    // cookie jar is encrypted using OS-level data protection APIs while
    // IndexedDB is not, and (b) we can force the key to expire after 24 hours.
    const keyHash = b64enc(
      await globalThis.crypto.subtle.digest("SHA-256", key)
    );
    const storedHash: string = await new Promise((resolve, reject) => {
      const op = db.transaction(dbStore).objectStore(dbStore).get(keyHashKey);
      op.onsuccess = () => resolve(op.result);
      op.onerror = (e) => reject(e);
    });

    if (storedHash === keyHash) {
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
          .put(keyHash, keyHashKey);
        op.onsuccess = () => resolve();
        op.onerror = (e) => reject(e);
      });
      broadcast({ type: "rekey", clear: undefined });
    } else {
      // Database exists but the original encryption key has expired. We got
      // unlucky; the expiry process should have cleaned it up by now...
      throw new Error(
        "writing to database created under old encryption key..."
      );
    }

    const cryptoKey = await globalThis.crypto.subtle.importKey(
      "raw",
      key,
      "AES-GCM",
      false,
      keyUsages
    );
    return new this(db, cryptoKey, keyHash, reload);
  }

  static broadcastReset() {
    broadcast({ type: "reset" });
  }

  static broadcastWrite(provider: string) {
    broadcast({ type: "write", provider });
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

  async encrypt(
    data: unknown,
    opts?: { binary: false }
  ): Promise<DatabaseRecord>;
  async encrypt(
    data: ArrayBufferLike,
    opts: { binary: true }
  ): Promise<DatabaseRecord>;
  async encrypt(
    data: unknown,
    opts?: { binary?: boolean }
  ): Promise<DatabaseRecord> {
    const source = (opts?.binary ? data : serialize(data)) as ArrayBufferLike;
    const iv = await globalThis.crypto.getRandomValues(new Uint8Array(12));
    return {
      iv: b64enc(iv),
      ciphertext: await globalThis.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        this.key,
        source
      ),
    };
  }

  async puts(records: ReadonlyArray<DatabaseRecord>): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const txn: IDBTransaction = this.db.transaction(dbStore, "readwrite");
      const store = txn.objectStore(dbStore);
      records.map((r) => store.put(r.ciphertext, r.iv));

      txn.oncomplete = () => resolve();
      txn.onerror = (e) => reject(e);
    });
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
    expireDatabaseAndKey(this.db, this.keyHash);
  }
}

async function expireDatabaseAndKey(db: IDBDatabase, keyHash: string | void) {
  await new Promise((resolve, reject) => {
    const op = db
      .transaction(dbStore, "readwrite")
      .objectStore(dbStore)
      .clear();
    op.onsuccess = () => resolve(op.result);
    op.onerror = (e) => reject(e);
  });
  broadcast({ type: "rekey", clear: keyHash });
  console.log("Reset database");
}

export async function maybeExpire(key: ArrayBuffer | void) {
  const db = await dbInit();
  if (!db) return;

  const keyHash =
    key && b64enc(await globalThis.crypto.subtle.digest("SHA-256", key));
  const storedHash: string = await new Promise((resolve, reject) => {
    const op = db.transaction(dbStore).objectStore(dbStore).get(keyHashKey);
    op.onsuccess = () => resolve(op.result);
    op.onerror = (e) => reject(e);
  });

  if (!storedHash) {
    // ok: database is empty
  } else if (storedHash === keyHash) {
    // ok: database key is current
  } else {
    // not ok: database key is expired or inconsistent
    expireDatabaseAndKey(db, keyHash);
  }

  db.close();
}
