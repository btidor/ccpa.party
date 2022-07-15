import type { Provider } from "@src/common/provider";
import { WriteBackend } from "@src/database/backend";
import { ProviderDatabase } from "@src/database/query";
import type {
  DataFile,
  DataFileKey,
  DatabaseRecord,
  TimelineEntry,
} from "@src/database/types";

// Increasing the batch size adds latency and makes the timeline view sluggish
// (because we have to sift through more extraneous data in order to load the
// items we want), but it also speeds up imports by a lot, especially on older
// browsers (because the per-put overhead is so high). :(
const batchSize = 64;

// Writing too much data in a single IndexedDB operation causes the Chrome tab
// to crash, possibly because it generates a too-large IPC message.
const fileBufferLimitBytes = 16 * 1024 * 1024;
const timelineEntryLimit = 1024;

export class Writer<T> {
  protected backend: WriteBackend;
  provider: Provider<T>;
  protected query: ProviderDatabase<T>;

  protected files: {
    pending: {
      records: DatabaseRecord[];
      size: number;
    };
    index: DataFileKey[];
  };
  protected metadata: Map<string, unknown>;
  protected timeline: {
    pendingBatch: TimelineEntry<T>[];
    pendingWrite: DatabaseRecord[];
    dedup: Set<string>;
    index: [string | void, number, string, number, string, T][];
  };

  constructor(backend: WriteBackend, provider: Provider<T>) {
    this.backend = backend;
    this.provider = provider;
    this.query = new ProviderDatabase(backend, provider);

    this.files = {
      pending: { records: [], size: 0 },
      index: [],
    };
    this.metadata = new Map();
    this.timeline = {
      pendingBatch: [],
      pendingWrite: [],
      dedup: new Set(),
      index: [],
    };
  }

  async putFile(file: DataFile): Promise<void> {
    const { data, ...metadata } = file;
    const record = await this.backend.encrypt(data, { binary: true });

    this.files.pending.records.push(record);
    this.files.pending.size += file.data.byteLength;
    this.files.index.push({ iv: record.iv, ...metadata });

    if (this.files.pending.size > fileBufferLimitBytes) {
      await this.flushFiles();
    }
  }

  async putMetadata(metadata: Map<string, unknown>): Promise<void> {
    metadata.forEach((v, k) => this.metadata.set(k, v));
  }

  async putTimelineEntry(entry: TimelineEntry<T>): Promise<void> {
    if (!this.timeline.dedup.has(entry.slug)) {
      this.timeline.pendingBatch.push(entry);
      this.timeline.dedup.add(entry.slug);
      if (this.timeline.pendingBatch.length >= batchSize) {
        await this.flushTimelineBatch();
      }
      if (this.timeline.pendingWrite.length * batchSize >= timelineEntryLimit) {
        await this.flushTimelineWrites();
      }
    }
  }

  protected async flushFiles(): Promise<void> {
    await this.backend.puts(this.files.pending.records);
    this.files.pending = {
      records: [],
      size: 0,
    };
  }

  protected async flushTimelineBatch(): Promise<void> {
    const record = await this.backend.encrypt(
      this.timeline.pendingBatch.map(({ file, context, value }) => [
        file,
        context,
        value,
      ])
    );
    this.timeline.pendingWrite.push(record);
    for (let i = 0; i < this.timeline.pendingBatch.length; i++) {
      const { day, timestamp, slug, category } = this.timeline.pendingBatch[i];
      this.timeline.index.push([record.iv, i, day, timestamp, slug, category]);
    }
    this.timeline.pendingBatch = [];
  }

  protected async flushTimelineWrites(): Promise<void> {
    await this.backend.puts(this.timeline.pendingWrite);
    this.timeline.pendingWrite = [];
  }

  // You MUST call `commit` in order to flush data and indexes.
  async commit(): Promise<void> {
    // Write files and compute index
    await this.flushFiles();
    this.files.index.sort((a, b) => a.path.join().localeCompare(b.path.join()));

    // Compute metadata index
    const metadataIndex = Array.from(this.metadata);
    metadataIndex.sort();

    // Write timeline entries and compute index
    await this.flushTimelineBatch();
    await this.flushTimelineWrites();
    this.timeline.index.sort((a, b) => a[4].localeCompare(b[4]));

    // Write provider index
    const record = await this.backend.encrypt({
      files: this.files.index,
      metadata: metadataIndex,
      timeline: this.timeline.index,
      hasErrors: this.files.index.some((file) => file.errors.length),
    });
    await this.backend.put(record);

    // Update root index
    await this.backend.updateRootIndex(
      (index) => (index[this.provider.slug] = record.iv)
    );

    // Reset internal state
    this.files = {
      pending: {
        records: [],
        size: 0,
      },
      index: [],
    };
    this.metadata = new Map();
    this.timeline = {
      pendingBatch: [],
      pendingWrite: [],
      dedup: new Set(),
      index: [],
    };

    // Notify everyone that the data has changed!
    WriteBackend.broadcastWrite(this.provider.slug);
  }
}

export class Resetter<T> {
  protected backend: WriteBackend;
  provider: Provider<T>;
  protected query: ProviderDatabase<T>;

  constructor(backend: WriteBackend, provider: Provider<T>) {
    this.backend = backend;
    this.provider = provider;
    this.query = new ProviderDatabase(backend, provider);
  }

  async resetProvider(): Promise<void> {
    const deletes = new Set<string | void>();

    // Delete data pages & provider index
    (await this.query.getFiles()).forEach((f) => deletes.add(f.iv));
    (await this.query.getTimelineEntries()).forEach((e) => deletes.add(e.iv));
    deletes.add(
      ((await this.backend.getRootIndex()) || {})[this.provider.slug]
    );
    deletes.delete(undefined);
    await this.backend.deletes(deletes as Set<string>);

    // Update root index
    await this.backend.updateRootIndex(
      (index) => delete index[this.provider.slug]
    );

    const remaining = new Set(Object.keys(await this.backend.getRootIndex()));
    remaining.delete(this.provider.slug);
    if (remaining.size === 0) {
      // Wipe the IndexedDB database, delete the key cookie (so the 24-hour
      // retention period restarts on next import) and broadcast a rekey event.
      this.backend.clear();
    } else {
      // Notify everyone that the data (but not the key) has changed
      WriteBackend.broadcastReset();
    }
  }
}
