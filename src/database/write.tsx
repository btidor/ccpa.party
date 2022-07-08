import type { Provider } from "@src/common/provider";
import { WriteBackend } from "@src/database/backend";
import { ProviderDatabase } from "@src/database/query";
import type { DataFile, DataFileKey, TimelineEntry } from "@src/database/types";

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
    uncommitted: DataFile[];
    uncommittedSize: number;
    index: DataFileKey[];
  };
  protected metadata: Map<string, unknown>;
  protected timeline: {
    uncommitted: TimelineEntry<T>[];
    dedup: Set<string>;
    index: [string | void, number, string, number, string, T][];
  };

  constructor(backend: WriteBackend, provider: Provider<T>) {
    this.backend = backend;
    this.provider = provider;
    this.query = new ProviderDatabase(backend, provider);

    this.files = {
      uncommitted: [],
      uncommittedSize: 0,
      index: [],
    };
    this.metadata = new Map();
    this.timeline = {
      uncommitted: [],
      dedup: new Set(),
      index: [],
    };
  }

  async putFile(file: DataFile): Promise<void> {
    this.files.uncommitted.push(file);
    this.files.uncommittedSize += file.data.byteLength;
    if (this.files.uncommittedSize > fileBufferLimitBytes) {
      await this.flushFiles();
    }
  }

  async putMetadata(metadata: Map<string, unknown>): Promise<void> {
    metadata.forEach((v, k) => this.metadata.set(k, v));
  }

  async putTimelineEntry(entry: TimelineEntry<T>): Promise<void> {
    if (!this.timeline.dedup.has(entry.slug)) {
      this.timeline.uncommitted.push(entry);
      this.timeline.dedup.add(entry.slug);
    }
    if (this.timeline.uncommitted.length > timelineEntryLimit) {
      await this.flushTimeline();
    }
  }

  protected async flushFiles(): Promise<void> {
    const ivs = await this.backend.puts(
      this.files.uncommitted.map(({ data }) => data),
      { binary: true }
    );
    this.files.index.push(
      ...this.files.uncommitted.map(({ data, ...rest }, i) => ({
        iv: ivs[i],
        ...rest,
      }))
    );
    this.files.uncommitted = [];
    this.files.uncommittedSize = 0;
  }

  protected async flushTimeline(): Promise<void> {
    const index: [string | void, number, string, number, string, T][][] = [];
    const writes = [];
    for (let i = 0; i < this.timeline.uncommitted.length; i += batchSize) {
      const batch = this.timeline.uncommitted.slice(i, i + batchSize);
      writes.push(
        batch.map(({ file, context, value }) => [file, context, value])
      );
      index.push(
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
    const ivs = await this.backend.puts(writes);
    for (let i = 0; i < ivs.length; i++) {
      index[i].forEach((row) => (row[0] = ivs[i]));
    }

    for (const entry of index.flat(1)) {
      this.timeline.index.push(entry);
    }
    this.timeline.uncommitted = [];
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
    await this.flushTimeline();
    this.timeline.index.sort((a, b) => a[4].localeCompare(b[4]));

    // Write provider index
    const iv = await this.backend.put({
      files: this.files.index,
      metadata: metadataIndex,
      timeline: this.timeline.index,
      hasErrors: this.files.index.some((file) => file.errors.length),
    });

    // Update root index
    await this.backend.updateRootIndex(
      (index) => (index[this.provider.slug] = iv)
    );

    // Reset internal state
    this.files = {
      uncommitted: [],
      uncommittedSize: 0,
      index: [],
    };
    this.metadata = new Map();
    this.timeline = {
      uncommitted: [],
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
