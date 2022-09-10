import { Transform, TransformCallback } from "node:stream";
import { createStream } from "sax";
import { Logger } from "@giancosta86/unified-logging";
import { formatError } from "@giancosta86/format-error";
import { WikiPage } from "./page";

export type WikiTransformOptions = Readonly<{
  highWaterMark?: number;
  signal?: AbortSignal;
  logger?: Logger;
  pageTag?: string;
}>;

const defaultPageTag = "page";

export class WikiTransform extends Transform {
  private readonly logger?: Logger;

  private readonly pageTag: string;

  private readonly characterBuffer: string[] = [];
  private bufferingCharacters = false;

  private currentTitle?: string;
  private currentText?: string;

  private saxError?: Error;

  private readonly saxStream = createStream(true)
    .on("opentag", tag => {
      switch (tag.name) {
        case this.pageTag:
          this.currentTitle = undefined;
          this.currentText = undefined;
          break;

        case "title":
        case "text":
          this.bufferingCharacters = true;
          break;
      }
    })
    .on("text", characters => {
      if (this.bufferingCharacters) {
        this.characterBuffer.push(characters);
      }
    })
    .on("cdata", characters => {
      if (this.bufferingCharacters) {
        this.characterBuffer.push(characters);
      }
    })
    .on("closetag", tag => {
      switch (tag) {
        case "title":
          this.bufferingCharacters = false;
          this.currentTitle = this.characterBuffer.join("");
          this.characterBuffer.length = 0;
          break;

        case "text":
          this.bufferingCharacters = false;
          this.currentText = this.characterBuffer.join("");
          this.characterBuffer.length = 0;
          break;

        case this.pageTag:
          if (!this.currentTitle) {
            this.logger?.info("Page without title!");
            return;
          }

          if (!this.currentText) {
            this.logger?.info(`Page '${this.currentTitle}' has no text!`);
            return;
          }

          this.push({
            title: this.currentTitle,
            text: this.currentText
          } as WikiPage);
      }
    })
    .on("error", err => {
      this.logger?.error(`Error while parsing page: ${formatError(err)}`);

      if (!this.saxError) {
        this.saxError = err;
      }
    });

  constructor(options?: WikiTransformOptions) {
    super({
      objectMode: true,
      highWaterMark: options?.highWaterMark,
      signal: options?.signal
    });

    this.logger = options?.logger;
    this.pageTag = options?.pageTag ?? defaultPageTag;
  }

  override _transform(
    chunk: any,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    this.saxStream.write(chunk, encoding);
    callback(this.saxError);
  }

  override _flush(callback: TransformCallback): void {
    this.saxStream.end();
    callback(this.saxError);
  }
}
