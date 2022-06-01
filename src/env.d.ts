/* eslint-disable @typescript-eslint/no-unused-vars */
/// <reference types="vite/client" />

declare module "colorjs.io";
declare module "emoji-name-map";

declare module "js-untar" {
  type File = {
    name: string;
    type: string;
    buffer: ArrayBufferLike;
  };

  function untar(buffer: ArrayBufferLike): Promise<File[]>;
  export default untar;
}

namespace globalThis {
  declare const DecompressionStream: {
    prototype: GenericTransformStream;
    new (format: "gzip" | "deflate"): DecompressionStream;
  };
}
