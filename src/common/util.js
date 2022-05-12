// @flow

export function b64enc(buf: BufferSource): string {
  return btoa(
    [...new Uint8Array(buf)].map((c) => String.fromCharCode(c)).join("")
  );
}

export function b64dec(str: string): BufferSource {
  return new Uint8Array([...atob(str)].map((c) => c.charCodeAt(0))).buffer;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function serialize(obj: any): BufferSource {
  return encoder.encode(JSON.stringify(obj));
}

export function deserialize(buf: BufferSource): any {
  return JSON.parse(decoder.decode(buf));
}

export function getCookie(name: string): ?string {
  const str = document.cookie.split(";").find((x) => x.startsWith(`${name}=`));
  return str && str.slice(name.length + 1);
}

export function setCookie(name: string, value: string, maxAge: number): void {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; secure`;
}
