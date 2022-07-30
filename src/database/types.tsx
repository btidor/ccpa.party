export type DataFileKey = {
  provider: string;
  path: ReadonlyArray<string>;
  slug: string; // hash of path
  skipped: "tooLarge" | void;
  iv?: string;
  status?: "parsed" | "skipped" | "empty" | "unknown";
  errors: ParseError[];
};

export type ParseStage = "tokenize" | "parse" | "transform";

export type ParseError = {
  stage: ParseStage;
  message: string;
  line?: string;
};

export type DataFile = DataFileKey & { data: ArrayBufferLike };

export type TimelineEntryKey<T> = {
  day: string;
  timestamp: number;
  slug: string;
  category: T;
  iv?: string;
  offset?: number;
};

export type TimelineUser = { display: string; color?: string };

export type TimelineContext = null | [string, string?, TimelineUser?];

export type TimelineEntry<T> = TimelineEntryKey<T> & {
  file: ReadonlyArray<string>;
  context: TimelineContext;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
};

export type DatabaseRecord = {
  readonly iv: string;
  readonly ciphertext: ArrayBuffer;
};
