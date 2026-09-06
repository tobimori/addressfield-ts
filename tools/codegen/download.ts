import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { HttpClient } from "effect/unstable/http";

import { MetadataError } from "./metadata.ts";

const maxBytes = 8 * 1024 * 1024;

export const download = Effect.fn(
  function* (url: string) {
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.withScope,
      HttpClient.filterStatusOk,
      HttpClient.retryTransient({ times: 2, schedule: Schedule.exponential("250 millis") }),
    );
    const response = yield* client.get(url);
    let size = 0;
    const chunks = yield* response.stream.pipe(
      Stream.runFoldEffect(
        () => Array<Uint8Array>(),
        (chunks, chunk) => {
          size += chunk.byteLength;
          if (size > maxBytes) {
            return Effect.fail(
              new MetadataError({ message: `Response exceeds the ${maxBytes}-byte limit.` }),
            );
          }
          chunks.push(chunk);
          return Effect.succeed(chunks);
        },
      ),
    );
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = yield* Effect.try({
      try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      catch: (cause) => new MetadataError({ message: "Response is not valid UTF-8.", cause }),
    });
    return { bytes, text };
  },
  Effect.scoped,
  (effect, url) =>
    effect.pipe(
      Effect.timeout("30 seconds"),
      Effect.mapError(
        (cause) =>
          new MetadataError({ message: `Download failed for ${url}: ${cause.message}`, cause }),
      ),
    ),
);
