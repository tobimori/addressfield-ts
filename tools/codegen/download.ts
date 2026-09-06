import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
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
    const bytes = new Uint8Array(yield* response.arrayBuffer);
    if (bytes.byteLength > maxBytes) {
      return yield* new MetadataError({
        message: `Response exceeds the ${maxBytes}-byte limit.`,
      });
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
