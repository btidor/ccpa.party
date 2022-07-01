import type { Provider } from "@src/common/provider";
import { WriteBackend } from "@src/database/backend";
import { ProviderDatabase } from "@src/database/query";
import type { DataFile, TimelineEntry } from "@src/database/types";

// Increasing the batch size adds latency and makes the timeline view sluggish
// (because we have to sift through more extraneous data in order to load the
// items we want), but it also speeds up imports by a lot, especially on older
// browsers (because the per-put overhead is so high). :(
const batchSize = 64;

export class Writer<T> {
  protected backend: WriteBackend;
  provider: Provider<T>;
  protected query: ProviderDatabase<T>;

  protected additions: {
    files: DataFile[];
    metadata: Map<string, unknown>;
    timeline: TimelineEntry<T>[];
    timelineDedup: Set<string>;
  };

  constructor(backend: WriteBackend, provider: Provider<T>) {
    this.backend = backend;
    this.provider = provider;
    this.query = new ProviderDatabase(backend, provider);

    this.additions = {
      files: [],
      metadata: new Map(),
      timeline: [],
      timelineDedup: new Set(),
    };
  }

  putFile(file: DataFile): void {
    this.additions.files.push(file);
  }

  putMetadata(metadata: Map<string, unknown>): void {
    metadata.forEach((v, k) => this.additions.metadata.set(k, v));
  }

  putTimelineEntry(entry: TimelineEntry<T>): void {
    if (!this.additions.timelineDedup.has(entry.slug)) {
      this.additions.timeline.push(entry);
      this.additions.timelineDedup.add(entry.slug);
    }
  }

  // You MUST call `commit` in order to flush data and indexes.
  async commit(): Promise<void> {
    // Write files and compute index
    const fileIvs = await this.backend.puts(
      this.additions.files.map(({ data }) => data),
      { binary: true }
    );
    const fileIndex = this.additions.files.map(({ data, ...rest }, i) => ({
      iv: fileIvs[i],
      ...rest,
    }));
    fileIndex.sort((a, b) => a.path.join().localeCompare(b.path.join()));

    // Compute metadata index
    const metadataIndex = Array.from(this.additions.metadata);
    metadataIndex.sort();

    // Write timeline entries and compute index
    const workingIndex: [string | void, number, string, number, string, T][][] =
      [];
    const writeQueue = [];
    for (let i = 0; i < this.additions.timeline.length; i += batchSize) {
      const batch = this.additions.timeline.slice(i, i + batchSize);
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
    const ivs = await this.backend.puts(writeQueue);
    for (let i = 0; i < ivs.length; i++) {
      workingIndex[i].forEach((row) => (row[0] = ivs[i]));
    }
    const timelineIndex = workingIndex.flat(1);
    timelineIndex.sort((a, b) => a[4].localeCompare(b[4]));

    // Write provider index
    const iv = await this.backend.put({
      files: fileIndex,
      metadata: metadataIndex,
      timeline: timelineIndex,
      hasErrors: this.additions.files.some((file) => file.errors.length),
    });

    // Update root index
    await this.backend.updateRootIndex(
      (index) => (index[this.provider.slug] = iv)
    );

    // Reset internal state
    this.additions = {
      files: [],
      metadata: new Map(),
      timeline: [],
      timelineDedup: new Set(),
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
    if (remaining.size === 0) this.backend.clear();

    // Notify everyone that the data has changed!
    WriteBackend.broadcastReset();
  }
}
