import type { Provider } from "@src/common/provider";
import type { ReadBackend, RootIndex } from "@src/database/backend";
import type {
  DataFile,
  DataFileKey,
  TimelineContext,
  TimelineEntry,
  TimelineEntryKey,
} from "@src/database/types";

type ProviderIndex = {
  files: DataFileKey[];
  metadata: [string, unknown][];
  timeline: [string, number, string, number, string, string][];
  hasErrors: boolean;
};

export class BaseDatabase {
  protected backend: ReadBackend | void;
  protected rootIndex: Promise<RootIndex>;
  // TODO: handle reloading

  constructor(backend: ReadBackend | void) {
    this.backend = backend;
    this.rootIndex = (async () =>
      backend ? await backend.getRootIndex() : {})();
  }

  async getProviders(): Promise<Set<string>> {
    return new Set(Object.keys(await this.rootIndex));
  }
}

export class ProviderDatabase<T> extends BaseDatabase {
  protected provider: Provider<T>;
  protected providerIndex: Promise<ProviderIndex>;

  constructor(backend: ReadBackend | void, provider: Provider<T>) {
    super(backend);
    this.provider = provider;
    this.providerIndex = (async () => {
      if (backend) {
        const iv = (await this.rootIndex)[provider.slug];
        const index = iv && (await backend.get(iv));
        if (index) return index as ProviderIndex;
      }
      return { files: [], metadata: [], timeline: [], hasErrors: false };
    })();
  }

  async getHasErrors(): Promise<boolean> {
    return (await this.providerIndex).hasErrors;
  }

  async getFiles(): Promise<ReadonlyArray<DataFileKey>> {
    return (await this.providerIndex).files;
  }

  async hydrateFile(file: DataFileKey): Promise<DataFile | void> {
    if (!file.iv) throw new Error("DataFileKey is missing IV");
    if (file.skipped) return { ...file, data: new ArrayBuffer(0) };
    if (!this.backend) return;
    const data = (await this.backend.get(file.iv, {
      binary: true,
    })) as ArrayBufferLike | void;
    if (!data) return;
    return { ...file, data };
  }

  async getMetadata(): Promise<ReadonlyMap<string, unknown>> {
    return new Map((await this.providerIndex).metadata);
  }

  async getTimelineEntries(): Promise<TimelineEntryKey<T>[]> {
    return (await this.providerIndex).timeline.map(
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
    if (!this.backend) return;
    const data = (await this.backend.get(entry.iv)) as [
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
    const entry = (await this.providerIndex).timeline.find(
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
