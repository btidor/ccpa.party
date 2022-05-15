// @flow
import csv from "csvtojson";
import MurmurHash3 from "imurmurhash";

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
  // Try simple UTF-8
  let text = utf8Decoder.decode(data);

  if (!isPrintableUnicode(text)) {
    // Try double-encoded UTF-8
    text = utf8Decoder.decode(
      // $FlowFixMe[incompatible-call]
      // $FlowFixMe[prop-missing]
      Uint8Array.from(text, (x) => x.charCodeAt(0))
    );

    if (!isPrintableUnicode(text)) {
      // Try UTF-16 big-endian (used in some Apple JSON files)
      text = utf16beDecoder.decode(data);

      if (!isPrintableUnicode(text)) {
        // Fail :(
        console.warn(
          data,
          Array.from(utf8Decoder.decode(data)).filter(
            (c) => !printableRegExp.test(c)
          )
        );
        throw new Error("Could not decode data to a printable Unicode string");
      }
    }
  }

  // Normalize line endings (csvtojson requires this)
  return text.replace(/(\r\n?)/g, "\n");
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
