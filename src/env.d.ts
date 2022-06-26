/* eslint-disable @typescript-eslint/no-unused-vars */
/// <reference types="vite/client" />

declare module "colorjs.io";
declare module "emoji-name-map";

namespace globalThis {
  declare const DecompressionStream: {
    prototype: GenericTransformStream;
    new (format: "gzip" | "deflate"): DecompressionStream;
  };
}

declare module "@go" {
  type TarEntry = {
    name: string;
    type: string;
    size: number;
  };
  type TarFile = {
    Next(): Promise<[TarEntry, unknown] | [void, unknown]>;
    Read(buf: Uint8Array): Promise<number>;
  };
  type Go = {
    hooks: {
      TarFile: {
        new (stream: ReadableStream): TarFile;
      };
    };
  };
  export default async function Run(): Promise<Go>;
}
