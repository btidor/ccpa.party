import React from "react";

import type { Provider } from "@src/common/provider";
import { clearKeyCookieIfMatch, getKeyFromCookie } from "@src/common/util";
import { ReadBackend, maybeExpire } from "@src/database/backend";
import { channelId } from "@src/database/backend";
import type { DatabaseBroadcast } from "@src/database/backend";
import { BaseDatabase, ProviderDatabase } from "@src/database/query";

// Globally cache the database backend: we use a single IndexedDB connection for
// all components and maintain it across page transitions.
//
// Important: if the database connection has not yet been initialized, `cache`
// should be undefined so no BaseDatabase or ProviderDatabase is returned to the
// caller. If the database connection has been made but the database is empty or
// uninitialized, `cache` should be set but `cache.backend` should be undefined
// so BaseDatabase/ProviderDatabase return empty results.
//
let cache: {
  backend: ReadBackend | void;
  supported: boolean;
} | void;
let initializer: Promise<void> | void;

const expiryCheckInterval = 60 * 1000; // milliseconds

async function initialize(): Promise<void> {
  initializer ||= (async () => {
    // We check whether the browser is supported here because we want the static
    // parts of the pages to render even on unsupported browsers. Accessing the
    // database is a dependency of all of the interactive parts of the app.
    const support = {
      broadcast: !!globalThis.BroadcastChannel,
      crypto: !!globalThis.crypto?.subtle,
      idb: undefined as boolean | void,
      locks: !!globalThis.navigator?.locks,
      transform: !!globalThis.TransformStream,
      wasm: !!globalThis.WebAssembly?.instantiateStreaming,
      worker: !!globalThis.Worker,
    };

    let backend;
    try {
      const key = await getKeyFromCookie();
      backend = key && (await ReadBackend.connect(key, reinitialize));
      support.idb = true;
    } catch (e) {
      if (e instanceof Event && e.target instanceof IDBOpenDBRequest) {
        // This usually means we're in a Firefox private window, where IndexedDB
        // is blocked: https://bugzilla.mozilla.org/show_bug.cgi?id=1639542
        support.idb = false;
      } else {
        throw e;
      }
    }

    const supported = Object.values(support).every((x) => x);
    cache = { backend, supported };
    if (supported) {
      console.log("Feature Detection OK", support);
    } else {
      console.error("Feature Detection Failed", support);
      return;
    }

    maybeExpire(getKeyFromCookie());
    setInterval(() => maybeExpire(getKeyFromCookie()), expiryCheckInterval);

    const bc = new BroadcastChannel(channelId);
    bc.onmessage = (msg: MessageEvent<DatabaseBroadcast>) => {
      (async () => {
        if (msg.data.type !== "rekey") return;
        if (msg.data.clear) await clearKeyCookieIfMatch(msg.data.clear);
        reinitialize();
      })();
    };
  })();
  await initializer;
}

// Open a new connection to the database and make all dependent React components
// refresh. Called when the key changes or when the database is cleared.
async function reinitialize(): Promise<void> {
  cache = undefined;
  initializer = undefined;
  const bc = new BroadcastChannel(channelId);
  bc.postMessage({ type: "reset" });
}

export function useBrowserSupport(): boolean | void {
  const [support, setSupport] = React.useState(cache?.supported);
  React.useEffect(() => {
    if (!cache) initialize().then(() => setSupport(cache?.supported));
  });
  return support;
}

function useBackendUpdates(provider?: Provider<unknown>): number {
  const [epoch, setEpoch] = React.useState(0);
  React.useEffect(() => {
    if (!cache) initialize().then(() => setEpoch((e) => e + 1));
  });
  React.useEffect(() => {
    if (!globalThis.BroadcastChannel) return; // in tests
    const bc = new BroadcastChannel(channelId);
    bc.onmessage = (msg: MessageEvent<DatabaseBroadcast>) => {
      const { data } = msg;
      if (data.type === "reset") setEpoch((e) => e + 1);
      if (data.type === "write" && data.provider === provider?.slug)
        setEpoch((e) => e + 1);
    };
  }, [provider, setEpoch]);
  return epoch;
}

export function useBaseDatabase(): BaseDatabase | void {
  const epoch = useBackendUpdates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useMemo(() => cache && new BaseDatabase(cache.backend), [epoch]);
}

export function useProviderDatabase<T>(
  provider: Provider<T>
): ProviderDatabase<T> | void {
  const epoch = useBackendUpdates(provider);
  return React.useMemo(
    () => cache && new ProviderDatabase(cache.backend, provider),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [epoch, provider]
  );
}
