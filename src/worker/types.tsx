// Types and constants are defined here. (If they lived in worker.tsx,
// non-worker code would pull in the whole worker and all its dependencies; if
// they lived in client.tsx, it would form a dependency cycle with client.tsx.)

export type WorkerMessage = (
  | {
      type: "importFiles";
      provider: string;
      files: FileList;
    }
  | { type: "resetProvider"; provider: string }
) & { id: string; key: ArrayBuffer };

// The IndexedDB limit is ~255M, but there's a lot of overhead somewhere...
export const fileSizeLimitMB = 128;
