// TODO: move back into database code?
export default async function isBrowserSupported(): Promise<boolean> {
  const support = {
    crypto: !!globalThis.crypto?.subtle,
    indexedDB: undefined as boolean | void,
    locks: !!globalThis.navigator?.locks,
  };
  // TODO: don't call this too often
  support.indexedDB = await new Promise<boolean>((resolve) => {
    const op = globalThis.indexedDB.open("featureTest", 1);
    op.onsuccess = () => (resolve(true), op.result.close());
    // This usually means we're in a Firefox private window, so no IndexedDB:
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1639542
    op.onerror = (e) => (
      console.error("Failed to open IndexedDB", e), resolve(false)
    );
  });
  console.log("Feature Detection", support);
  return Object.values(support).every((x) => x);
}
