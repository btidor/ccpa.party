// @flow
import csv from "csvtojson";
import pako from "pako";
import MurmurHash3 from "imurmurhash";
import untar from "js-untar";
import { unzip } from "unzipit";

import { WritableDatabase } from "common/database";

import type { DataFile, TimelineEntry } from "common/database";
import type { Provider } from "common/provider";

export async function autoParse(
  file: DataFile,
  timelineLabels: { [string]: [string, string] },
  settingLabels: { [string]: string }
): Promise<$ReadOnlyArray<TimelineEntry>> {
  if (file.skipped) return [];
  const ext = file.path.slice(-1)[0].split(".").slice(-1)[0];
  switch (ext) {
    case "json": {
      const parsed = parseJSON(file.data);

      const settingLabel = settingLabels[file.path.slice(1).join("/")];
      if (settingLabel) {
        return [];
      }

      const pair = timelineLabels[file.path.slice(1).join("/")];
      let timelineLabel, category;
      if (pair) [timelineLabel, category] = pair;

      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => discoverEntry(file, entry, timelineLabel, category))
          .filter((x) => x);
      }

      const keys = Object.keys(parsed);
      if (keys.length === 1 && Array.isArray(parsed[keys[0]])) {
        return parsed[keys[0]]
          .map((entry) => discoverEntry(file, entry, timelineLabel, category))
          .filter((x) => x);
      }
      return [];
    }
    default: {
      return [];
    }
  }
}

export function discoverEntry(
  file: DataFile,
  obj: any,
  timelineLabel: ?string,
  category: string
): ?TimelineEntry {
  const label =
    obj.name ||
    obj.title ||
    obj.text ||
    obj.action ||
    obj.event ||
    obj.advertiser_name ||
    JSON.stringify(obj);

  let timestamp =
    obj.timestamp ||
    obj.timestamp_ms ||
    obj.verification_time ||
    obj.start_timestamp ||
    obj.added_timestamp ||
    obj.removed_timestamp;
  if (timestamp > 9999999999) timestamp /= 1000;

  return timestamp
    ? {
        type: "timeline",
        provider: file.provider,
        file: file.path,
        category,
        ...getSlugAndDay(timestamp, obj),
        context: [timelineLabel || "unknown: " + file.path.join("/"), label],
        value: obj,
      }
    : undefined;
}

const printableRegExp =
  /^(\p{L}|\p{M}|\p{N}|\p{S}|\p{P}|\p{Z}|\p{Cf}|\n|\r|\t)*$/u;
const utf8Decoder = new TextDecoder("utf-8");
const utf16beDecoder = new TextDecoder("utf-16be");
const jsonReviver = (key: any, value: any): any =>
  typeof value === "string" ? smartDecodeText(value) : value;
const isPrintableUnicode = (str: string): boolean => {
  const batchSize = 1024;
  for (let i = 0; i < str.length; i += batchSize) {
    if (!printableRegExp.test(str.slice(i, i + batchSize))) return false;
  }
  return true;
};

export function parseJSON(data: BufferSource | string): any {
  let text;
  if (typeof data === "string") text = data;
  else text = utf8Decoder.decode(data);

  try {
    return JSON.parse(text, jsonReviver);
  } catch (err) {
    if (typeof data === "string") throw err;

    // Seen in some Apple *.pkpass files
    text = utf16beDecoder.decode(data);
    return JSON.parse(text, jsonReviver);
  }
}

export async function parseCSV(
  data: BufferSource | string
): Promise<$ReadOnlyArray<{ [string]: string }>> {
  let text;
  if (typeof data === "string") text = data;
  else text = smartDecode(data);

  return await csv().fromString(text);
}

// Some companies (e.g. Amazon, Facebook) mis-encode some of their files, for
// instance by applying UTF-8 encoding twice.
export function smartDecode(data: BufferSource): string {
  // Simple UTF-8
  let text = utf8Decoder.decode(data);
  if (isPrintableUnicode(text)) return text;

  // Double-encoded UTF-8
  text = utf8Decoder.decode(
    // $FlowFixMe[incompatible-call]
    // $FlowFixMe[prop-missing]
    Uint8Array.from(text, (x) => x.charCodeAt(0))
  );
  if (isPrintableUnicode(text)) return text;

  // UTF-16 big-endian (used in some Apple JSON files)
  text = utf16beDecoder.decode(data);
  if (isPrintableUnicode(text)) return text;

  console.warn(
    data,
    Array.from(utf8Decoder.decode(data)).filter((c) => !printableRegExp.test(c))
  );
  throw new Error("Could not decode data to a printable Unicode string");
}

export function smartDecodeText(text: string): string {
  if (isPrintableUnicode(text)) return text;

  // Try double-encoded UTF-8
  text = utf8Decoder.decode(
    // $FlowFixMe[incompatible-call]
    // $FlowFixMe[prop-missing]
    Uint8Array.from(text, (x) => x.charCodeAt(0))
  );
  if (isPrintableUnicode(text)) return text;

  console.warn(
    text,
    Array.from(text).filter((c) => !printableRegExp.test(c))
  );
  throw new Error("Could not decode text to a printable Unicode string");
}

export function getSlugAndDay(
  timestamp: number,
  value: any
): {|
  slug: string,
  day: string,
|} {
  if (isNaN(timestamp)) throw new Error("Received NaN for timestamp");
  const hash = MurmurHash3(JSON.stringify(value));
  const slug =
    parseInt(timestamp).toString(16).padStart(8, "0") +
    hash.result().toString(16).padStart(8, "0");

  const date = new Date(timestamp * 1000);
  const day =
    date.getFullYear().toString() +
    "-" +
    (date.getMonth() + 1).toString().padStart(2, "0") +
    "-" +
    date.getDate().toString().padStart(2, "0");
  return { slug, day };
}

export const fileSizeLimitMB = 16;

type ImportFile = {|
  path: $ReadOnlyArray<string>,
  data: () => Promise<BufferSource>,
|};

export async function importFiles(
  provider: Provider,
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
      await db.putFile(dataFile);
      return;
    } else {
      const dataFile = ({
        provider: provider.slug,
        path,
        data,
        skipped: undefined,
      }: DataFile);
      await db.putFile(dataFile);
      const parsed = await provider.parse(dataFile);
      for (const entry of parsed) {
        if (entry.type === "metadata") await db.putMetadata(entry);
        else if (entry.type === "timeline") await db.putTimelineEntry(entry);
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
  await db.commit();
  if (process.env.NODE_ENV === "development") {
    console.warn(`Time: ${(new Date().getTime() - start) / 1000}s`);
  }
}

export async function resetProvider(
  provider: Provider,
  terminated: () => void
) {
  const db = new WritableDatabase(provider, terminated);
  await db.resetProvider();
}
