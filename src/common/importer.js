// @flow
import csv from "csvtojson";
import MurmurHash3 from "imurmurhash";

import type { DataFile, TimelineEntry } from "common/database";

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
const isPrintableUnicode = (str: string): boolean =>
  Array.from(str).every((c) => printableRegExp.test(c));

export function parseJSON(data: ArrayBuffer | string): any {
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
  data: ArrayBuffer | string
): Promise<$ReadOnlyArray<{ [string]: string }>> {
  let text;
  if (typeof data === "string") text = data;
  else text = smartDecode(data);

  return await csv().fromString(text);
}

// Some companies (e.g. Amazon, Facebook) mis-encode some of their files, for
// instance by applying UTF-8 encoding twice.
export function smartDecode(data: ArrayBuffer): string {
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
