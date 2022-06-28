import type { Provider } from "@src/common/provider";
import { getOrGenerateKeyFromCookie } from "@src/common/util";
import WorkerBackend from "@src/workerBackend?worker";

export type WorkerMessage = (
  | {
      type: "importFiles";
      provider: string;
      files: FileList;
    }
  | { type: "resetProvider"; provider: string }
) & { id: string; key: ArrayBuffer };

const worker = new WorkerBackend();
const pending = new Map<string, () => void>();

worker.onmessage = (msg: MessageEvent<string>) => pending.get(msg.data)?.();

export async function importFiles(
  provider: Provider<unknown>,
  files: FileList
): Promise<void> {
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
