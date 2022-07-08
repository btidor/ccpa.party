// Types and constants are defined here. (If they lived in worker.tsx,
// non-worker code would pull in the whole worker and all its dependencies; if
// they lived in client.tsx, it would form a dependency cycle with client.tsx.)
import type { DataFile } from "@src/database/types";

export type WorkerRequest = (
  | {
      type: "importFiles";
      key: ArrayBuffer;
      provider: string;
      files: FileList;
    }
  | { type: "resetProvider"; key: ArrayBuffer; provider: string }
  | { type: "decodeData"; data: ArrayBufferLike; tryJSON: boolean }
  | { type: "parseByStages"; provider: string; file: DataFile }
) & { id: string };

export type WorkerResponse = (
  | { type: "done"; result: unknown }
  | { type: "progress"; fraction: number }
) & { id: string };

export type DecodeResponse =
  | { type: "json"; parsed: unknown }
  | { type: "text"; parsed: string }
  | { type: "empty" }
  | { type: "error" };

// The IndexedDB limit is ~255M, but there's a lot of overhead somewhere...
export const fileSizeLimitMB = 128;
