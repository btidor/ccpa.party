// @flow
import csv from "csvtojson";
import MurmurHash3 from "imurmurhash";

import type { DataFile, TimelineContext, TimelineEntry } from "common/database";

export type Parser<T> = {|
  +glob: string,
  +tokenizer: (BufferSource | string) => any,
  +renderer: ({| [string]: any |}) => ?[T, any, TimelineContext],
|};

const printableRegExp =
  // U+F8FF is the Apple logo on macOS
  /^(\p{L}|\p{M}|\p{N}|\p{S}|\p{P}|\p{Z}|\p{Cf}|\n|\r|\t|\u{f8ff})*$/u;
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

export function parseJSON(
  data: BufferSource | string,
  // Use `smart: true` to try UTF-8 double-decoding everything. (Incurs a ~5x
  // slowdown).
  opts?: {| smart?: boolean |}
): any {
  let text;
  if (typeof data === "string") text = data;
  else text = utf8Decoder.decode(data);

  const reviver = opts?.smart ? jsonReviver : undefined;

  try {
    return JSON.parse(text, reviver);
  } catch (err) {
    if (typeof data === "string") throw err;

    // Seen in some Apple *.pkpass files
    text = utf16beDecoder.decode(data);
    return JSON.parse(text, reviver);
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
  // Try simple UTF-8
  const basic = utf8Decoder.decode(data);

  // Try double-encoded UTF-8
  const double = utf8Decoder.decode(
    // $FlowFixMe[incompatible-call]
    // $FlowFixMe[prop-missing]
    Uint8Array.from(basic, (x) => x.charCodeAt(0))
  );

  // Double-encoded UTF-8 often appears valid, e.g. a double-encoded "é" is
  // "Ã©". So we need to check it first.
  let text;
  if (isPrintableUnicode(double)) text = double;
  else if (isPrintableUnicode(basic)) text = basic;
  else {
    // Try UTF-16 big-endian (used in some Apple JSON files)
    text = utf16beDecoder.decode(data);

    if (!isPrintableUnicode(text)) {
      // Fail :(
      console.warn(
        "Smart Decode Failed:",
        data,
        Array.from(utf8Decoder.decode(data)).filter(
          (c) => !printableRegExp.test(c)
        )
      );
      throw new Error("Could not decode data to a printable Unicode string");
    }
  }

  // Normalize line endings (csvtojson requires this)
  return text.replace(/(\r\n?)/g, "\n");
}

export function smartDecodeText(text: string): string {
  // First try double-encoded UTF-8 (see note above)
  const double = utf8Decoder.decode(
    // $FlowFixMe[incompatible-call]
    // $FlowFixMe[prop-missing]
    Uint8Array.from(text, (x) => x.charCodeAt(0))
  );
  if (isPrintableUnicode(double)) return double;
  if (isPrintableUnicode(text)) return text;

  console.warn(
    "Smart Decode Text Failed:",
    text,
    Array.from(text).filter((c) => !printableRegExp.test(c))
  );
  throw new Error("Could not decode text to a printable Unicode string");
}

export function getSlugAndDayTime(
  timestamp: number,
  value: any
): {|
  slug: string,
  day: string,
  timestamp: number,
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
  return { slug, day, timestamp };
}

export async function parseByStages<T>(
  file: DataFile,
  parsers: $ReadOnlyArray<any>
): Promise<$ReadOnlyArray<TimelineEntry<T>>> {
  const path = file.path.slice(1).join("/");
  const parser = parsers.find((c) => c.glob.match(path));
  if (!parser) return [];

  let tokens;
  try {
    tokens = await parser.tokenizer(file.data);
  } catch (e) {
    console.error("Tokenization Error", path, e);
    return [];
  }

  if (!Array.isArray(tokens)) {
    console.error("Non-Array Tokenization", path, tokens);
    return [];
  }

  return tokens
    .map((tok) => {
      let parsed;
      try {
        parsed = parser.renderer(tok);
      } catch (e) {
        console.error("Parse Error", path, tok, e);
        return undefined;
      }
      if (!parsed) return undefined;
      console.warn(path, tok, parsed);

      const [category, datetime, context] = parsed;
      return ({
        file: file.path,
        category,
        ...getSlugAndDayTime(datetime.toSeconds(), parsed),
        context,
        value: tok,
      }: TimelineEntry<T>);
    })
    .filter((x) => x);
}
