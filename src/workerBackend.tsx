import { importFiles, resetProvider } from "@src/common/importer";
import { ProviderLookup } from "@src/common/provider";
import type { WorkerMessage } from "@src/worker";

onmessage = (message: MessageEvent<WorkerMessage>) => {
  (async () => {
    const { data } = message;
    const provider = ProviderLookup.get(data.provider);
    if (!provider) throw new Error("unknown provider: " + provider);

    if (data.type === "importFiles") {
      await importFiles(data.key, provider, data.files);
    } else if (data.type === "resetProvider") {
      await resetProvider(data.key, provider);
    } else {
      throw new Error("unknown request type");
    }
    postMessage(data.id);
  })();
};
