import type { Provider } from "@src/common/provider";
import { getOrGenerateKeyFromCookie } from "@src/common/util";
import type { WorkerMessage } from "@src/worker/types";
import Worker from "@src/worker/worker?worker";

// TODO: adjust
const worker = import.meta.env.SSR ? undefined : new Worker();
const pending = new Map<string, () => void>();

if (worker) {
  worker.onmessage = (msg: MessageEvent<string>) => pending.get(msg.data)?.();
}

export async function importFiles(
  provider: Provider<unknown>,
  files: FileList
): Promise<void> {
  if (!worker) throw new Error("can't invoke worker in server-side rendering");

  const id = globalThis.crypto.randomUUID();
  const key = await getOrGenerateKeyFromCookie();
  await new Promise<void>((resolve) => {
    pending.set(id, resolve);
    worker.postMessage({
      id,
      key,
      type: "importFiles",
      provider: provider.slug,
      files,
    } as WorkerMessage);
  });
}

export async function resetProvider(
  provider: Provider<unknown>
): Promise<void> {
  if (!worker) throw new Error("can't invoke worker in server-side rendering");

  const id = globalThis.crypto.randomUUID();
  const key = await getOrGenerateKeyFromCookie();
  await new Promise<void>((resolve) => {
    pending.set(id, resolve);
    worker.postMessage({
      id,
      key,
      type: "resetProvider",
      provider: provider.slug,
    } as WorkerMessage);
  });
}
