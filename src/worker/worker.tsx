import { Gunzip, gunzip } from "fflate";
import { unzip } from "unzipit";

import { parseByStages } from "@src/common/parse";
import { Provider, ProviderLookup } from "@src/common/provider";
import { serialize } from "@src/common/util";
import { WriteBackend } from "@src/database/backend";
import type { DataFile } from "@src/database/types";
import { Resetter, Writer } from "@src/database/write";
import { fileSizeLimitMB } from "@src/worker/types";
import type { WorkerMessage } from "@src/worker/types";

import Go from "@go";

const fallbackBlockSize = 64 * 1024 * 1024;

type ImportFile = {
  path: ReadonlyArray<string>;
  data: File | ArrayBufferLike;
};

async function importFiles<T>(
  key: ArrayBuffer,
  provider: Provider<T>,
  files: FileList
) {
  const start = new Date().getTime();
  const backend = await WriteBackend.connect(key, async () => undefined);
  const writer = new Writer(backend, provider);

  const work: ImportFile[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    work.push({ path: [file.name], data: file });
  }
  if (work.length < 1) {
    return;
  }

  const metadata = new Map();
  const processEntry = async (
    path: ReadonlyArray<string>,
    data: ArrayBufferLike
  ): Promise<ImportFile | void> => {
    if (path.at(-1)?.endsWith(".zip") || path.at(-1)?.endsWith(".tar.gz")) {
      return { path, data };
    }

    const tooLarge = data.byteLength > (2 << 20) * fileSizeLimitMB;
    const hash = new Uint32Array(
      await crypto.subtle.digest("SHA-1", serialize(path.join("/")))
    );
    const dataFile: DataFile = {
      provider: provider.slug,
      path,
      slug: Array.from(hash.slice(0, 2))
        .map((c) => c.toString(16).padStart(8, "0"))
        .join(""),
      data: tooLarge ? new ArrayBuffer(0) : data,
      skipped: tooLarge ? "tooLarge" : undefined,
      errors: [],
    };
    writer.putFile(dataFile);

    const result = await parseByStages(provider, dataFile);
    result.timeline.forEach((entry) => writer.putTimelineEntry(entry));
    result.metadata.forEach(([key, value]) => metadata.set(key, value));
    result.errors.forEach((entry) => dataFile.errors.push(entry));
    dataFile.status = result.status;
    writer.putFile(dataFile);
    return;
  };

  for (const { path, data } of work) {
    if (path.at(-1)?.endsWith(".zip")) {
      const zip = await unzip(data);
      for (const entry of Object.values(zip.entries || [])) {
        if (entry.isDirectory) continue;
        const subpath = [
          ...path,
          ...entry.name.split("/").filter((x) => x && x !== "."),
        ];
        const next = await processEntry(subpath, await entry.arrayBuffer());
        if (next) work.push(next);
      }
    } else if (path.at(-1)?.endsWith(".tar.gz")) {
      let stream: ReadableStream<Uint8Array>;
      if (data instanceof File) {
        if ("DecompressionStream" in globalThis) {
          const decompressor = new DecompressionStream("gzip");
          data.stream().pipeThrough(decompressor);
          stream = decompressor.readable;
        } else {
          stream = new ReadableStream({
            async start(controller) {
              const decompressor = new Gunzip(
                (chunk: Uint8Array, final: boolean) => {
                  final ? controller.close() : controller.enqueue(chunk);
                }
              );
              for (let i = 0; i < data.size; i += fallbackBlockSize) {
                const slice = new Uint8Array(
                  await data.slice(i, i + fallbackBlockSize).arrayBuffer()
                );
                decompressor.push(slice, false);
              }
              decompressor.push(new Uint8Array(), true);
            },
          });
        }
      } else {
        stream = new ReadableStream({
          async start(controller) {
            gunzip(new Uint8Array(data), { consume: true }, (err, data) => {
              if (err) throw err;
              controller.enqueue(data);
              controller.close();
            });
          },
        });
      }

      const go = await Go();
      const tar = new go.hooks.TarFile(stream);
      for (;;) {
        const [entry, err] = await tar.Next();
        if (err === "EOF") break;
        else if (err) throw err;

        if (entry?.type !== "0") continue;
        const subpath = [
          ...path,
          ...entry.name.split("/").filter((x) => x && x !== "."),
        ];
        const buf = new Uint8Array(entry.size);
        const ret = await tar.Read(buf);
        if (ret !== entry.size)
          throw new Error(
            "Invalid read length: got " + ret + ", expected: " + entry.size
          );
        const next = await processEntry(subpath, buf);
        if (next) work.push(next);
      }
    } else {
      throw new Error("Unknown file: " + path.at(-1));
    }
  }
  writer.putMetadata(metadata);
  const middle = new Date().getTime();
  console.warn(`Parse Time: ${(new Date().getTime() - start) / 1000}s`);

  await writer.commit();
  console.warn(`Database Time: ${(new Date().getTime() - middle) / 1000}s`);
  console.warn(`Total Time: ${(new Date().getTime() - start) / 1000}s`);
}

async function resetProvider<T>(key: ArrayBuffer, provider: Provider<T>) {
  const backend = await WriteBackend.connect(key, async () => undefined);
  const resetter = new Resetter(backend, provider);
  await resetter.resetProvider();
}

onmessage = (message: MessageEvent<WorkerMessage>) => {
  (async () => {
    const { data } = message;
    const provider = ProviderLookup.get(data.provider);
    if (!provider) throw new Error("unknown provider: " + provider);

    if (data.type === "importFiles") {
      await importFiles(data.key, provider, data.files);
    } else if (data.type === "resetProvider") {
      await resetProvider(data.key, provider);
    } else {
      throw new Error("unknown request type");
    }
    postMessage(data.id);
  })();
};
