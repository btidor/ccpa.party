import React from "react";

import type { Provider } from "@src/common/provider";
import { getKeyFromCookie } from "@src/common/util";
import { ReadBackend } from "@src/database/backend";
import { BaseDatabase, ProviderDatabase } from "@src/database/query";

// Globally cache the database backend: we use a single IndexedDB connection for
// all components and maintain it across page transitions.
let cache: {
  backend: ReadBackend | void;
  supported: boolean;
} | void;
let initializer: Promise<void> | void;

async function initialize(): Promise<void> {
  initializer ||= (async () => {
    // We check whether the browser is supported here because we want the static
    // parts of the pages to render even on unsupported browsers. Accessing the
    // database is a dependency of all of the interactive parts of the app.
    const support = {
      crypto: !!globalThis.crypto?.subtle,
      locks: !!globalThis.navigator?.locks,
    } as { [key: string]: boolean };

    let backend;
    try {
      const key = await getKeyFromCookie();
      backend = key && (await ReadBackend.connect(key));
      support.indexedDB = true;
    } catch (e) {
      if (e instanceof Event && e.target instanceof IDBOpenDBRequest) {
        // This usually means we're in a Firefox private window, where IndexedDB
        // is blocked: https://bugzilla.mozilla.org/show_bug.cgi?id=1639542
        support.indexedDB = false;
      } else {
        throw e;
      }
    }

    const supported = Object.values(support).every((x) => x);
    if (supported) console.log("Feature Detection OK", support);
    else console.error("Feature Detection Failed", support);

    cache = { backend, supported };
  })();
  await initializer;
}

export function useBrowserSupport(): boolean | void {
  const [support, setSupport] = React.useState(cache?.supported);
  React.useEffect(() => {
    if (!cache) initialize().then(() => setSupport(cache?.supported));
  });
  return support;
}

export function useBaseDatabase(): BaseDatabase {
  const [epoch, setEpoch] = React.useState(0);
  React.useEffect(() => {
    if (!cache) initialize().then(() => setEpoch((e) => e + 1));
  });
  // TODO: subscribe to further updates
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useMemo(() => new BaseDatabase(cache?.backend), [epoch]);
}

export function useProviderDatabase<T>(
  provider: Provider<T>
): ProviderDatabase<T> {
  const [epoch, setEpoch] = React.useState(0);
  React.useEffect(() => {
    if (!cache) initialize().then(() => setEpoch((e) => e + 1));
  });
  return React.useMemo(
    // TODO: subscribe to further updates
    () => new ProviderDatabase(cache?.backend, provider),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [epoch, provider]
  );
}
