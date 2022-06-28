const keyCookie = "key";
const keyMaxAge = 24 * 3600; // 24 hours

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
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; secure; samesite=strict`;
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

export async function streamToArray(
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const values = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    values.push(value);
  }
  const size = values.reduce((s, b) => (s += b.length), 0);
  const result = new Uint8Array(size);
  values.reduce((s, b) => (result.set(b, s), (s += b.length)), 0);
  return result;
}
