import type { DateTime } from "luxon";
import type { IMinimatch } from "minimatch";

import type { Provider } from "@src/common/provider";
import type { TimelineContext } from "@src/database/types";
import Amazon from "@src/parsers/amazon";
import Apple from "@src/parsers/apple";
import Discord from "@src/parsers/discord";
import Facebook from "@src/parsers/facebook";
import GitHub from "@src/parsers/github";
import Google from "@src/parsers/google";
import Netflix from "@src/parsers/netflix";
import Slack from "@src/parsers/slack";

import type { GoHooks } from "@go";

export type Tokenizer<U> = (
  data: ArrayBufferLike,
  go: GoHooks
) => U[] | Promise<U[]>;

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

export type TimelineCategory = {
  char: string; // single-character identifier for URLs
  icon: string;
  displayName: string;
  defaultEnabled: boolean;
};

export interface Parser<T> {
  slug: string;

  ignore: ReadonlyArray<IgnoreParser>;
  metadata?: ReadonlyArray<MetadataParser>;
  timeline: ReadonlyArray<TimelineParser<T>>;
}

const ParserRegistry: Parser<unknown>[] = [
  new Amazon(),
  new Apple(),
  new Discord(),
  new Facebook(),
  new GitHub(),
  new Google(),
  new Netflix(),
  new Slack(),
];

export function getParser<T>(provider: Provider<T>): Parser<T> {
  const parser = ParserRegistry.find((p) => p.slug === provider.slug);
  if (!parser) throw new Error("Parser not found: " + provider.slug);
  return parser as Parser<T>;
}
