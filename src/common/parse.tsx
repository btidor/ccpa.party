import csv from "csvtojson";
import { DateTime } from "luxon";
import type { IMinimatch } from "minimatch";

import { Provider } from "@src/common/provider";
import { serialize } from "@src/common/util";
import type {
  DataFile,
  ParseError,
  ParseStage,
  TimelineContext,
  TimelineEntry,
} from "@src/database/types";

export type Tokenizer<U> = (data: ArrayBufferLike) => U[] | Promise<U[]>;

export type TokenizedItem = { [key: string]: unknown };
export type TimelineTuple<T> = [T, DateTime, TimelineContext];
export type ParsedItem<T> = TimelineTuple<T> | TimelineTuple<T>[] | void;

export type MetadataParser = {
  glob: IMinimatch;
  tokenize?: Tokenizer<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parse: (item: any) => [string, unknown];
};

export type TimelineParser<T> = (
  | {
      tokenize?: Tokenizer<TokenizedItem>;
      parse: (item: TokenizedItem) => ParsedItem<T>;
    }
  | {
      tokenize: Tokenizer<string>;
      parse: (item: string) => ParsedItem<T>;
    }
) & {
  glob: IMinimatch;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parse: (item: any) => ParsedItem<T>;
};

export type IgnoreParser = { glob: IMinimatch };

type Parser<T> = MetadataParser | TimelineParser<T>;

const defaultTokenizers = new Map<string, Tokenizer<TokenizedItem>>([
  ["csv", parseCSV],
  ["json", parseJSON],
]);

const printableRegExp =
  // U+F8FF is the Apple logo on macOS
  /^(\p{L}|\p{M}|\p{N}|\p{S}|\p{P}|\p{Z}|\p{Cf}|\n|\r|\t|\u{f8ff})*$/u;
const utf8Decoder = new TextDecoder("utf-8");
const utf16beDecoder = new TextDecoder("utf-16be");
const jsonReviver = (_key: unknown, value: unknown): unknown =>
  typeof value === "string" ? smartDecodeText(value) : value;
const isPrintableUnicode = (str: string): boolean => {
  const batchSize = 1024;
  for (let i = 0; i < str.length; i += batchSize) {
    if (!printableRegExp.test(str.slice(i, i + batchSize))) return false;
  }
  return true;
};

export function parseJSON(
  data: ArrayBufferLike | string,
  // Use `smart: true` to try UTF-8 double-decoding everything. (Incurs a ~5x
  // slowdown).
  opts?: { smart?: boolean }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export function parseJSONND(
  data: ArrayBufferLike | string,
  opts?: { smart?: boolean }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  let text;
  if (typeof data === "string") text = data;
  else text = utf8Decoder.decode(data);

  return text
    .split("\n")
    .filter((x) => x)
    .map((line) => parseJSON(line, opts));
}

export async function parseCSV(
  data: ArrayBufferLike | string
): Promise<{ [key: string]: string }[]> {
  let text;
  if (typeof data === "string") text = data;
  else text = smartDecode(data);

  return await csv().fromString(text);
}

// Some companies (e.g. Amazon, Facebook) mis-encode some of their files, for
// instance by applying UTF-8 encoding twice.
export function smartDecode(data: ArrayBufferLike): string {
  // Try simple UTF-8
  const basic = utf8Decoder.decode(data);

  // Try double-encoded UTF-8
  const double = utf8Decoder.decode(
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
      throw new Error("Could not decode data to a printable Unicode string");
    }
  }

  // Normalize line endings (csvtojson requires this)
  return text.replace(/(\r\n?)/g, "\n");
}

export function smartDecodeText(text: string): string {
  // First try double-encoded UTF-8 (see note above)
  const double = utf8Decoder.decode(
    Uint8Array.from(text, (x) => x.charCodeAt(0))
  );
  if (isPrintableUnicode(double)) return double;
  if (isPrintableUnicode(text)) return text;

  throw new Error("Could not decode text to a printable Unicode string");
}

async function tokenize<T>(
  parser: Parser<T>,
  path: string,
  data: ArrayBufferLike
): Promise<unknown[]> {
  const ext = path.split(".").at(-1) || "";

  const tokenizer = parser.tokenize || defaultTokenizers.get(ext);
  if (!tokenizer) {
    throw new Error(`No default tokenizer for .${ext || "unknown"}`);
  }

  const tokens = await tokenizer(data);
  if (!Array.isArray(tokens)) throw new Error("Non-Array Tokenization");
  return tokens;
}

export type ParseResponse<T> = {
  timeline: TimelineEntry<T>[];
  metadata: [string, unknown][];
  errors: ParseError[];
  status: "parsed" | "skipped" | "unknown";
};

export async function parseByStages<T>(
  provider: Provider<T>,
  file: DataFile
): Promise<ParseResponse<T>> {
  const path = file.path.slice(1).join("/");
  const timelineParser = provider.timelineParsers.find((c) =>
    c.glob.match(path)
  );
  const metadataParser = provider.metadataParsers?.find((c) =>
    c.glob.match(path)
  );
  const ignoreParser = provider.ignoreParsers?.find((c) => c.glob.match(path));

  const response = {
    timeline: [],
    metadata: [],
    errors: [],
    status: ignoreParser ? "skipped" : "unknown",
  } as ParseResponse<T>;

  if (metadataParser) {
    response.status = "parsed";
    try {
      const tokenized = await tokenize(metadataParser, path, file.data);

      for (const line of tokenized) {
        try {
          const [key, value] = metadataParser.parse(line);
          response.metadata.push([key, value]);
        } catch (error) {
          response.errors.push(handleError(error, "parse", line));
        }
      }
    } catch (error) {
      response.errors.push(handleError(error, "tokenize"));
    }
  }

  if (timelineParser) {
    response.status = "parsed";
    try {
      const tokenized = await tokenize(timelineParser, path, file.data);

      for (const line of tokenized) {
        try {
          let parsed = timelineParser.parse(line) || [];
          parsed = (
            !parsed.length || Array.isArray(parsed[0]) ? parsed : [parsed]
          ) as TimelineTuple<T>[];

          for (const [category, datetime, context] of parsed) {
            try {
              const timestamp = datetime.toSeconds();
              if (isNaN(timestamp))
                throw new Error("Received NaN for timestamp");

              const hash = await crypto.subtle.digest("SHA-1", serialize(line));
              const slug =
                Math.floor(timestamp).toString(16).padStart(8, "0") +
                new Uint32Array(hash)[0].toString(16).padStart(8, "0");

              response.timeline.push({
                file: file.path,
                category,
                slug,
                day: datetime.toISODate(),
                timestamp,
                context,
                value: line,
              });
            } catch (error) {
              response.errors.push(handleError(error, "transform", line));
            }
          }
        } catch (error) {
          response.errors.push(handleError(error, "parse", line));
        }
      }
    } catch (error) {
      response.errors.push(handleError(error, "tokenize"));
    }
  }

  return response;
}

function handleError(
  error: unknown,
  stage: ParseStage,
  line?: unknown
): ParseError {
  if (error instanceof Error) {
    return {
      stage,
      message: error.message,
      line: line === undefined ? line : JSON.stringify(line),
    };
  } else {
    return {
      stage,
      message: `Unknown Error: ${error}`,
      line: line === undefined ? line : JSON.stringify(line),
    };
  }
}
