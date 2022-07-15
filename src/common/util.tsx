const keyCookie = "key";
const keyMaxAge = 24 * 3600; // 24 hours

export const archiveSuffixes = [".zip", ".tar.gz", ".tgz", ".mbox"];

export function b64enc(buf: ArrayBufferLike): string {
  return btoa(
    Array.from(new Uint8Array(buf))
      .map((c) => String.fromCharCode(c))
      .join("")
  )
    .replaceAll("/", "_")
    .replaceAll("+", "-");
}

export function b64dec(str: string): ArrayBufferLike {
  return new Uint8Array(
    Array.from(atob(str.replaceAll("_", "/").replaceAll("-", "+"))).map((c) =>
      c.charCodeAt(0)
    )
  ).buffer;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function serialize(obj: unknown): ArrayBufferLike {
  return encoder.encode(JSON.stringify(obj));
}

export function deserialize(buf: ArrayBufferLike): unknown {
  return JSON.parse(decoder.decode(buf));
}

export function getCookie(name: string): string | undefined {
  return document.cookie
    .split(";")
    .find((x) => x.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export function setCookie(name: string, value: string, maxAge: number): void {
  let directives = [
    `${name}=${value}`,
    `path=/`,
    `max-age=${maxAge}`,
    `secure`,
    `samesite=strict`,
  ];
  if (globalThis.location?.hostname === "localhost") {
    // HACK: due to WebKit bug #231035, the `secure` attribute causes the cookie
    // to be dropped in Safari when running on `localhost` (e.g. in Playwright
    // tests).
    console.warn("localhost detected, setting non-secure cookie");
    directives = directives.filter((x) => x !== "secure");
  }
  document.cookie = directives.join("; ");
}

export function getKeyFromCookie(): ArrayBuffer | undefined {
  const cookie = getCookie(keyCookie);
  return cookie ? b64dec(cookie) : undefined;
}

export async function getOrGenerateKeyFromCookie(): Promise<ArrayBuffer> {
  // Do this first to avoid race conditions reading/writing document.cookie
  const rand = await globalThis.crypto.getRandomValues(new Uint8Array(32));

  const key = getKeyFromCookie();
  if (key) return key;
  setCookie(keyCookie, b64enc(rand), keyMaxAge);
  return rand;
}

export async function clearKeyCookieIfMatch(matchHash: string): Promise<void> {
  const cookieKey = getKeyFromCookie();
  if (!cookieKey) return;
  const cookieHash = b64enc(
    await globalThis.crypto.subtle.digest("SHA-256", cookieKey)
  );
  if (cookieHash !== matchHash) return;

  setCookie(keyCookie, "", 0);
  console.log("Cleared encryption key");
}
