// @flow

export function b64enc(buf: BufferSource): string {
  return btoa(
    [...new Uint8Array(buf)].map((c) => String.fromCharCode(c)).join("")
  );
}

export function b64dec(str: string): BufferSource {
  return new Uint8Array([...atob(str)].map((c) => c.charCodeAt(0))).buffer;
}

export async function getOrSetCookie(
  name: string,
  generate: () => Promise<[string, number]>
): Promise<string> {
  let value = document.cookie.split(";").find((x) => x.startsWith(`${name}=`));
  if (value) return value.slice(name.length + 1);

  const [newValue, maxAge] = await generate();

  // Re-check cookie (it might have changed during `generate()`)
  value = document.cookie.split(";").find((x) => x.startsWith(`${name}=`));
  if (value) return value.slice(name.length + 1);

  document.cookie = `${name}=${newValue}; path=/; max-age=${maxAge}; secure`;
  return newValue;
}
