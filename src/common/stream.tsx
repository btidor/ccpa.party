import { Gunzip } from "fflate";

export class ArrayBufferStream extends ReadableStream<Uint8Array> {
  constructor(buffer: ArrayBuffer, chunkSize: number) {
    let i = 0;
    const array = new Uint8Array(buffer);
    super({
      async pull(controller) {
        if (i >= array.length) {
          controller.close();
        } else {
          const chunk = array.slice(i, i + chunkSize);
          i += chunk.length;
          controller.enqueue(chunk);
        }
      },
    });
  }
}

export class ChunkingStream extends TransformStream<Uint8Array, Uint8Array> {
  constructor(minChunkSize: number) {
    let buffer: Uint8Array[] = [];
    let bytes = 0;
    super({
      async transform(chunk, controller) {
        if (!bytes && chunk.byteLength > minChunkSize) {
          controller.enqueue(chunk);
        } else {
          buffer.push(chunk);
          bytes += chunk.byteLength;
          if (bytes > minChunkSize) {
            const chunk = new Uint8Array(bytes);
            let i = 0;
            for (const item of buffer) {
              chunk.set(item, i);
              i += item.byteLength;
            }
            buffer = [];
            bytes = 0;
            controller.enqueue(chunk);
          }
        }
      },
      async flush(controller) {
        if (bytes) {
          const chunk = new Uint8Array(bytes);
          let i = 0;
          for (const item of buffer) {
            chunk.set(item, i);
            i += item.byteLength;
          }
          controller.enqueue(chunk);
        }
      },
    });
  }
}

class FflateDecompressionStream extends TransformStream<
  Uint8Array,
  Uint8Array
> {
  constructor(_: "gzip") {
    let decompressor: Gunzip;
    super({
      async start(controller) {
        decompressor = new Gunzip((chunk: Uint8Array, final: boolean) =>
          final ? controller.terminate() : controller.enqueue(chunk)
        );
      },
      async transform(chunk) {
        decompressor.push(chunk, false);
      },
      flush() {
        decompressor.push(new Uint8Array(), true);
      },
    });
  }
}

export const DecompressionStream: {
  new (format: "gzip"): TransformStream<Uint8Array, Uint8Array>;
} =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).DecompressionStream || FflateDecompressionStream;

export class ProgressStream<T extends ArrayBufferView> extends TransformStream<
  T,
  T
> {
  constructor(callback: (bytes: number) => void) {
    let progress = 0;
    super({
      async transform(chunk, controller) {
        progress += chunk.byteLength;
        callback(progress);
        controller.enqueue(chunk);
      },
    });
  }
}
