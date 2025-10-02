import { unzip } from "unzipit";

import { getParser } from "@src/common/parser";
import { Provider, ProviderLookup } from "@src/common/provider";
import {
  ArrayBufferStream,
  ChunkingStream,
  DecompressionStream,
  MboxDecoderStream,
  ProgressStream,
  TextDecoderPonyfillStream,
} from "@src/common/stream";
import { archiveSuffixes, serialize } from "@src/common/util";
import { WriteBackend } from "@src/database/backend";
import type { DataFile } from "@src/database/types";
import { Resetter, Writer } from "@src/database/write";
import { parseByStages, parseJSON, smartDecode } from "@src/worker/parse";
import { DecodeResponse, fileSizeLimitMB } from "@src/worker/types";
import type { WorkerRequest, WorkerResponse } from "@src/worker/types";

import Go from "@go";

type ImportFile = {
  path: ReadonlyArray<string>;
  data: File | ArrayBuffer;
};

const chunkSize = 32 * 1024 * 1024;

async function listProfiles<T>(
  provider: Provider<T>,
  files: FileList,
): Promise<string[] | void> {
  const parser = getParser(provider);
  if (
    !parser.profile ||
    files.length !== 1 ||
    !files[0].name.endsWith(".zip")
  ) {
    // TODO: better handle these cases
    return;
  }

  const zip = await unzip(await files[0].arrayBuffer());
  const entry = zip.entries[parser.profile.file];
  return parser.profile.extract(await entry.arrayBuffer());
}

async function importFiles<T>(
  key: ArrayBuffer,
  provider: Provider<T>,
  profile: string | void,
  files: FileList,
  reportProgress: (fraction: number) => void,
): Promise<void> {
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
    data: ArrayBuffer,
  ): Promise<ImportFile | void> => {
    if (archiveSuffixes.some((s) => path.at(-1)?.endsWith(s))) {
      return { path, data };
    }

    // TODO: store oversize files by chunking them up
    const tooLarge = data.byteLength > (2 << 20) * fileSizeLimitMB;
    const hash = new Uint32Array(
      await crypto.subtle.digest("SHA-1", serialize(path.join("/"))),
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

    const result = await parseByStages(
      provider,
      profile,
      dataFile,
      (await go).hooks,
    );
    for (const entry of result.timeline) {
      await writer.putTimelineEntry(entry);
    }
    result.metadata.forEach(([key, value]) => metadata.set(key, value));
    result.errors.forEach((entry) => dataFile.errors.push(entry));
    dataFile.status = result.status;
    await writer.putFile(dataFile);
    return;
  };

  for (const { path, data } of work) {
    if (path.at(-1)?.endsWith(".zip")) {
      const zip = await unzip(data);
      const entries = Object.values(zip.entries);

      let count = 0;
      const size = entries.reduce((s, e) => s + e.size, 0);

      for (const entry of entries) {
        count += entry.size;
        reportProgress(count / size);
        if (entry.isDirectory) continue;
        const subpath = [
          ...path,
          ...entry.name.split("/").filter((x) => x && x !== "."),
        ];
        // TODO: only entries with a matching path should be decompressed (and
        // counted towards size)
        const next = await processEntry(subpath, await entry.arrayBuffer());
        if (next) work.push(next);
      }
    } else if (path.at(-1)?.endsWith(".tar.gz")) {
      let size: number;
      let stream: ReadableStream<Uint8Array>;
      if (data instanceof File) {
        size = data.size;
        stream = data.stream().pipeThrough(new ChunkingStream(chunkSize));
      } else {
        size = data.byteLength;
        stream = new ArrayBufferStream(data, chunkSize);
      }

      // Report progress as we read the underlying data. This has to be on the
      // original, compressed file because we know its size ahead of time.
      stream = stream.pipeThrough(
        new ProgressStream((bytes) => reportProgress(bytes / size)),
      );

      // Un-gzip!
      stream = stream.pipeThrough(new DecompressionStream("gzip"));

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
            "Invalid read length: got " + ret + ", expected: " + entry.size,
          );
        const next = await processEntry(
          subpath,
          buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
        );
        if (next) work.push(next);
      }
    } else if (path.at(-1)?.endsWith(".mbox")) {
      // Google exports Gmail messages as an uncompressed *.mbox file. Fun fact:
      // these files can be so large that `.arrayBuffer()` fails: we *have* to
      // handle them as streams. We pretend the *.mbox is an archive where each
      // message is an *.eml file.
      let size: number;
      let stream: ReadableStream<Uint8Array>;
      if (data instanceof File) {
        size = data.size;
        stream = data.stream();
      } else {
        size = data.byteLength;
        stream = new ArrayBufferStream(data, chunkSize);
      }

      // Report progress as we read the underlying data.
      stream = stream.pipeThrough(
        new ProgressStream((bytes) => reportProgress(bytes / size)),
      );

      const output = stream
        .pipeThrough(new TextDecoderPonyfillStream())
        .pipeThrough(new MboxDecoderStream());

      const reader = output.getReader();
      const encoder = new TextEncoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const enc = encoder.encode(value.data);
        const next = await processEntry(
          [...path, (value.msgid || crypto.randomUUID()) + ".eml"],
          enc.buffer.slice(enc.byteOffset, enc.byteOffset + enc.byteLength),
        );
        if (next)
          throw new Error("*.mbox processing should not result in next");
      }
    } else {
      throw new Error("Unknown file: " + path.at(-1));
    }
  }
  await writer.putMetadata(metadata);
  const middle = new Date().getTime();
  console.log(`Parse Time: ${(new Date().getTime() - start) / 1000}s`);

  await writer.commit();
  console.log(`Database Time: ${(new Date().getTime() - middle) / 1000}s`);
  console.log(`Total Time: ${(new Date().getTime() - start) / 1000}s`);
}

async function resetProvider<T>(key: ArrayBuffer, provider: Provider<T>) {
  const backend = await WriteBackend.connect(key, async () => undefined);
  const resetter = new Resetter(backend, provider);
  await resetter.resetProvider();
}

function sendResponse(msg: WorkerResponse) {
  postMessage(msg);
}

async function decodeData(
  data: ArrayBuffer,
  tryJSON: boolean,
): Promise<DecodeResponse> {
  if (tryJSON) {
    try {
      return { type: "json", parsed: await parseJSON(data) };
    } catch {
      // Fall through
    }
  }
  try {
    const parsed = await smartDecode(data);
    if (parsed && /^\n*$/.test(parsed)) return { type: "empty" };
    else return { type: "text", parsed };
  } catch {
    return { type: "error" };
  }
}

const go = Go();

onmessage = (message: MessageEvent<WorkerRequest>) => {
  (async () => {
    const { data } = message;

    let previous = Date.now();
    const reportProgress = (fraction: number) => {
      const now = Date.now();
      if (now - previous < 200) return; // debounce
      sendResponse({ type: "progress", id: data.id, fraction });
      previous = now;
    };

    let result: unknown = null;
    if (data.type === "listProfiles") {
      const provider = ProviderLookup.get(data.provider);
      if (!provider) throw new Error("unknown provider: " + provider);
      result = await listProfiles(provider, data.files);
    } else if (data.type === "importFiles") {
      const provider = ProviderLookup.get(data.provider);
      if (!provider) throw new Error("unknown provider: " + provider);
      await importFiles(
        data.key,
        provider,
        data.profile,
        data.files,
        reportProgress,
      );
    } else if (data.type === "resetProvider") {
      const provider = ProviderLookup.get(data.provider);
      if (!provider) throw new Error("unknown provider: " + provider);
      await resetProvider(data.key, provider);
    } else if (data.type === "decodeData") {
      result = await decodeData(data.data, data.tryJSON);
    } else if (data.type === "parseByStages") {
      const provider = ProviderLookup.get(data.provider);
      if (!provider) throw new Error("unknown provider: " + provider);
      result = await parseByStages(
        provider,
        undefined,
        data.file,
        (await go).hooks,
      );
    } else {
      throw new Error("unknown request type");
    }
    sendResponse({ type: "done", id: data.id, result });
  })();
};
