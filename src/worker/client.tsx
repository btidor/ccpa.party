import type { Provider } from "@src/common/provider";
import { getOrGenerateKeyFromCookie } from "@src/common/util";
import type { DataFile } from "@src/database/types";
import type {
  DecodeResponse,
  WorkerRequest,
  WorkerResponse,
} from "@src/worker/types";
import Worker from "@src/worker/worker?worker";

let worker: Worker | void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pending = new Map<string, (result: any) => void>();
const progress = new Map<string, (fraction: number) => void>();

function sendRequest(msg: WorkerRequest): void {
  if (!worker) {
    worker = new Worker();
    worker.onmessage = (msg: MessageEvent<WorkerResponse>) => {
      const { data } = msg;
      if (data.type === "done") {
        pending.get(data.id)?.(data.result);
      } else if (data.type === "progress") {
        progress.get(data.id)?.(data.fraction);
      } else {
        throw new Error("unknown response type");
      }
    };
  }
  worker.postMessage(msg);
}

export async function listProfiles(
  provider: Provider<unknown>,
  files: FileList
): Promise<string[] | void> {
  const id = globalThis.crypto.randomUUID();
  return await new Promise<string[] | void>((resolve) => {
    pending.set(id, resolve);
    sendRequest({
      id,
      type: "listProfiles",
      provider: provider.slug,
      files,
    });
  });
}

export async function importFiles(
  provider: Provider<unknown>,
  profile: string | void,
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
      profile,
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

export async function decodeData(
  data: ArrayBufferLike,
  tryJSON: boolean
): Promise<DecodeResponse> {
  const id = globalThis.crypto.randomUUID();
  return await new Promise<DecodeResponse>((resolve) => {
    pending.set(id, resolve);
    sendRequest({
      id,
      type: "decodeData",
      data,
      tryJSON,
    });
  });
}

export async function parseByStages(
  provider: Provider<unknown>,
  file: DataFile
): Promise<unknown> {
  const id = globalThis.crypto.randomUUID();
  return await new Promise<DecodeResponse>((resolve) => {
    pending.set(id, resolve);
    sendRequest({
      id,
      type: "parseByStages",
      provider: provider.slug,
      file,
    });
  });
}
