import pako from "pako";
import untar from "js-untar";
import { unzip } from "unzipit";

import { WritableDatabase } from "common/database";

import type { DataFile } from "common/database";
import type { Provider } from "common/provider";

export const fileSizeLimitMB = 16;

type ImportFile = {
  path: ReadonlyArray<string>,
  data: () => Promise<ArrayBufferLike>,
};

export async function importFiles(
  provider: Provider<any>,
  files: ReadonlyArray<File>,
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
  let errors = 0;
  const processEntry = async (
    path: ReadonlyArray<string>,
    data: ArrayBufferLike
  ): Promise<ImportFile | void> => {
    if (
      path.slice(-1)[0].endsWith(".zip") ||
      path.slice(-1)[0].endsWith(".tar.gz")
    ) {
      return ({ path, data: () => Promise.resolve(data) });
    } else if (data.byteLength > (2 << 20) * fileSizeLimitMB) {
      const dataFile = ({
        provider: provider.slug,
        path,
        data: new ArrayBuffer(0),
        skipped: "tooLarge",
      } as DataFile);
      db.putFile(dataFile);
      return;
    } else {
      const dataFile = ({
        provider: provider.slug,
        path,
        data,
        skipped: undefined,
      });
      db.putFile(dataFile);
      try {
        (await provider.parse(dataFile, metadata)).forEach((entry) =>
          db.putTimelineEntry(entry)
        );
      } catch (e) {
        console.error("Error parsing " + dataFile.path.join("/"), e);
        errors++;
      }
      return;
    }
  };

  for (const { path, data } of work) {
    if (path.slice(-1)[0].endsWith(".zip")) {
      const zip = await unzip(await data());
      for (const entry of (Object.values(zip.entries || []))) {
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

  await db.commit(errors);
  console.warn(`Database Time: ${(new Date().getTime() - middle) / 1000}s`);
  console.warn(`Total Time: ${(new Date().getTime() - start) / 1000}s`);
}

export async function resetProvider(
  provider: Provider<any>,
  terminated: () => void
) {
  const db = new WritableDatabase(provider, terminated);
  await db.resetProvider();
}
