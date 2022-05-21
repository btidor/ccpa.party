/// <reference types="react-scripts" />

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
