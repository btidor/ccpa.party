import type { Provider } from "@src/common/provider";
import { getOrGenerateKeyFromCookie } from "@src/common/util";
import type { WorkerRequest, WorkerResponse } from "@src/worker/types";
import Worker from "@src/worker/worker?worker";

let worker: Worker | void;
const pending = new Map<string, () => void>();
const progress = new Map<string, (fraction: number) => void>();

function sendRequest(msg: WorkerRequest): void {
  if (!worker) {
    worker = new Worker();
    worker.onmessage = (msg: MessageEvent<WorkerResponse>) => {
      const { data } = msg;
      if (data.type === "done") {
        pending.get(data.id)?.();
      } else if (data.type === "progress") {
        progress.get(data.id)?.(data.fraction);
      } else {
        throw new Error("unknown response type");
      }
    };
  }
  worker.postMessage(msg);
}

export async function importFiles(
  provider: Provider<unknown>,
  files: FileList,
  reportProgress: (fraction: number) => void
): Promise<void> {
  const id = globalThis.crypto.randomUUID();
  const key = await getOrGenerateKeyFromCookie();
  await new Promise<void>((resolve) => {
    pending.set(id, resolve);
    progress.set(id, reportProgress);
    sendRequest({
      id,
      key,
      type: "importFiles",
      provider: provider.slug,
      files,
    });
  });
}

export async function resetProvider(
  provider: Provider<unknown>
): Promise<void> {
  const id = globalThis.crypto.randomUUID();
  const key = await getOrGenerateKeyFromCookie();
  await new Promise<void>((resolve) => {
    pending.set(id, resolve);
    sendRequest({
      id,
      key,
      type: "resetProvider",
      provider: provider.slug,
    });
  });
}
