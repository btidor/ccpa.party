// @flow
import pako from "pako";
import untar from "js-untar";
import { unzip } from "unzipit";

import { WritableDatabase } from "common/database";

import type { DataFile } from "common/database";
import type { Provider } from "common/provider";

export const fileSizeLimitMB = 16;

type ImportFile = {|
  path: $ReadOnlyArray<string>,
  data: () => Promise<BufferSource>,
|};

export async function importFiles(
  provider: Provider<any>,
  files: $ReadOnlyArray<File>,
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
    path: $ReadOnlyArray<string>,
    data: BufferSource
  ): Promise<?ImportFile> => {
    if (
      path.slice(-1)[0].endsWith(".zip") ||
      path.slice(-1)[0].endsWith(".tar.gz")
    ) {
      return ({ path, data: () => Promise.resolve(data) }: ImportFile);
    } else if (data.byteLength > (2 << 20) * fileSizeLimitMB) {
      const dataFile = ({
        provider: provider.slug,
        path,
        data: new ArrayBuffer(0),
        skipped: "tooLarge",
      }: DataFile);
      db.putFile(dataFile);
      return;
    } else {
      const dataFile = ({
        provider: provider.slug,
        path,
        data,
        skipped: undefined,
      }: DataFile);
      db.putFile(dataFile);
      try {
        (await provider.parse(dataFile, metadata)).forEach((entry) =>
          db.putTimelineEntry(entry)
        );
      } catch (e) {
        console.warn("Error importing " + dataFile.path.join("/"));
        throw e;
      }
      return;
    }
  };

  for (const { path, data } of work) {
    if (path.slice(-1)[0].endsWith(".zip")) {
      const zip = await unzip(await data());
      for (const entry of (Object.values(zip.entries || []): any)) {
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
  await db.commit();
  if (process.env.NODE_ENV === "development") {
    console.warn(`Time: ${(new Date().getTime() - start) / 1000}s`);
  }
}

export async function resetProvider(
  provider: Provider<any>,
  terminated: () => void
) {
  const db = new WritableDatabase(provider, terminated);
  await db.resetProvider();
}
