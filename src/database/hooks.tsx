import React from "react";

import type { Provider } from "@src/common/provider";
import { getKeyFromCookie } from "@src/common/util";
import { ReadBackend } from "@src/database/backend";
import { BaseDatabase, ProviderDatabase } from "@src/database/query";

// Globally cache the database backend: we use a single IndexedDB connection for
// all components and maintain it across page transitions.
let backend: ReadBackend | void;
let initialized = false;
let initializer: Promise<void> | void;

async function initialize(): Promise<void> {
  initializer ||= (async () => {
    const key = await getKeyFromCookie();
    backend = key && (await ReadBackend.connect(key));
    initialized = true;
  })();
  await initializer;
}

export function useBaseDatabase(): BaseDatabase {
  const [epoch, setEpoch] = React.useState(0);
  React.useEffect(() => {
    if (!initialized) initialize().then(() => setEpoch((e) => e + 1));
  });
  // TODO: subscribe to further updates
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useMemo(() => new BaseDatabase(backend), [epoch]);
}

export function useProviderDatabase<T>(
  provider: Provider<T>
): ProviderDatabase<T> {
  const [epoch, setEpoch] = React.useState(0);
  React.useEffect(() => {
    if (!initialized) initialize().then(() => setEpoch((e) => e + 1));
  });
  return React.useMemo(
    // TODO: subscribe to further updates
    () => new ProviderDatabase(backend, provider),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [epoch, provider]
  );
}
