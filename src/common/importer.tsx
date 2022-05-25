import { parseByStages } from "./parse";
import untar from "js-untar";
import pako from "pako";
import { unzip } from "unzipit";

import { WritableDatabase } from "@src/common/database";
import type { DataFile } from "@src/common/database";
import type { Provider } from "@src/common/provider";

export const fileSizeLimitMB = 16;

type ImportFile = {
  path: ReadonlyArray<string>;
  data: () => Promise<ArrayBufferLike>;
};

export async function importFiles<T>(
  provider: Provider<T>,
  files: FileList,
  terminated: () => void
) {
  const start = new Date().getTime();
  const db = new WritableDatabase(provider, terminated);
  const work: Array<ImportFile> = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    work.push({ path: [file.name], data: () => file.arrayBuffer() });
  }
  if (work.length < 1) {
    return;
  }

  const metadata = new Map();
  const processEntry = async (
    path: ReadonlyArray<string>,
    data: ArrayBufferLike
  ): Promise<ImportFile | void> => {
    if (
      path.slice(-1)[0].endsWith(".zip") ||
      path.slice(-1)[0].endsWith(".tar.gz")
    ) {
      return { path, data: () => Promise.resolve(data) };
    } else if (data.byteLength > (2 << 20) * fileSizeLimitMB) {
      const dataFile = {
        provider: provider.slug,
        path,
        data: new ArrayBuffer(0),
        skipped: "tooLarge",
      } as DataFile;
      db.putFile(dataFile);
      return;
    } else {
      const dataFile = {
        provider: provider.slug,
        path,
        data,
        skipped: undefined,
      };
      db.putFile(dataFile);
      (
        await parseByStages(
          dataFile,
          metadata,
          provider.timelineParsers,
          provider.metadataParsers || []
        )
      ).forEach((entry) => db.putTimelineEntry(entry));
      return;
    }
  };

  for (const { path, data } of work) {
    if (path.slice(-1)[0].endsWith(".zip")) {
      const zip = await unzip(await data());
      for (const entry of Object.values(zip.entries || [])) {
        if (entry.isDirectory) continue;
        const subpath = [
          ...path,
          ...entry.name.split("/").filter((x) => x && x !== "."),
        ];
        const next = await processEntry(subpath, await entry.arrayBuffer());
        if (next) work.push(next);
      }
    } else if (path.slice(-1)[0].endsWith(".tar.gz")) {
      const inflated = pako.inflate(await data());
      const entries = await untar(inflated.buffer);
      for (const entry of entries) {
        if (entry.type !== "0") continue;
        const subpath = [
          ...path,
          ...entry.name.split("/").filter((x) => x && x !== "."),
        ];
        const next = await processEntry(subpath, entry.buffer);
        if (next) work.push(next);
      }
    } else {
      throw new Error("Unknown file: " + path.slice(-1)[0]);
    }
  }
  db.putMetadata(metadata);
  const middle = new Date().getTime();
  console.warn(`Parse Time: ${(new Date().getTime() - start) / 1000}s`);

  await db.commit();
  console.warn(`Database Time: ${(new Date().getTime() - middle) / 1000}s`);
  console.warn(`Total Time: ${(new Date().getTime() - start) / 1000}s`);
}

export async function resetProvider<T>(
  provider: Provider<T>,
  terminated: () => void
) {
  const db = new WritableDatabase(provider, terminated);
  await db.resetProvider();
}
