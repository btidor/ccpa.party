import { importFiles, resetProvider } from "@src/common/importer";
import { ProviderLookup } from "@src/common/provider";
import type { WorkerMessage } from "@src/worker";

onmessage = (message: MessageEvent<WorkerMessage>) => {
  const { data } = message;
  const provider = ProviderLookup.get(data.provider);
  if (!provider) throw new Error("unknown provider: " + provider);

  const done = () => postMessage(data.id);
  if (data.type === "importFiles") {
    importFiles(data.key, provider, data.files, done);
  } else if (data.type === "resetProvider") {
    resetProvider(data.key, provider, done);
  } else {
    throw new Error("unknown request type");
  }
};

export {};
