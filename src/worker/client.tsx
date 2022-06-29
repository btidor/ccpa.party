import type { Provider } from "@src/common/provider";
import { getOrGenerateKeyFromCookie } from "@src/common/util";
import type { WorkerMessage } from "@src/worker/types";
import Worker from "@src/worker/worker?worker";

let worker: Worker | void;
const pending = new Map<string, () => void>();

function sendMessage(msg: WorkerMessage): void {
  if (!worker) {
    worker = new Worker();
    worker.onmessage = (msg: MessageEvent<string>) => pending.get(msg.data)?.();
  }
  worker.postMessage(msg);
}

export async function importFiles(
  provider: Provider<unknown>,
  files: FileList
): Promise<void> {
  const id = globalThis.crypto.randomUUID();
  const key = await getOrGenerateKeyFromCookie();
  await new Promise<void>((resolve) => {
    pending.set(id, resolve);
    sendMessage({
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
    sendMessage({
      id,
      key,
      type: "resetProvider",
      provider: provider.slug,
    });
  });
}
