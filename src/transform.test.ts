import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ArrayLogger } from "@giancosta86/unified-logging";
import { WikiPage } from "./page";
import { WikiTransform } from "./transform";

async function expectWikiPages(
  xmlString: string,
  expectedPages: readonly WikiPage[]
): Promise<ArrayLogger> {
  const actualPages: WikiPage[] = [];

  const sourceStream = Readable.from([xmlString]);

  const logger = new ArrayLogger();

  const wikiTransform = new WikiTransform({ logger }).on(
    "data",
    (page: WikiPage) => actualPages.push(page)
  );

  await pipeline(sourceStream, wikiTransform);

  expect(actualPages).toEqual(expectedPages);
  expect(logger.errorMessages.length).toBe(0);

  return logger;
}

describe("Wiki transform", () => {
  it("should support being just constructed and destroyed", () => {
    const transform = new WikiTransform();
    transform.destroy();
  });

  it("should ignore a well-formed XML string without wiki pages", () =>
    expectWikiPages("<hello>world</hello>", []));

  it("should extract a single wiki page", () =>
    expectWikiPages(
      `
      <page>
        <title>Alpha</title>
        <text>This is the text!</text>
      </page>
      `,
      [
        {
          title: "Alpha",
          text: "This is the text!"
        }
      ]
    ));

  describe("within a page", () => {
    it("should ignore the field order", () =>
      expectWikiPages(
        `
        <page>
          <text>This is the text!</text>
          <title>Alpha</title>
        </page>
        `,

        [
          {
            title: "Alpha",
            text: "This is the text!"
          }
        ]
      ));

    it("should ignore additional fields", () =>
      expectWikiPages(
        `
        <page>
          <title>Alpha</title>
          <someProp>A</someProp>
          <text>This is the text!</text>
        </page>
        `,

        [
          {
            title: "Alpha",
            text: "This is the text!"
          }
        ]
      ));

    it("should unescape XML entities", () =>
      expectWikiPages(
        `
        <page>
          <title>Alpha</title>
          <someProp>A</someProp>
          <text>X &amp; &lt; &gt; &apos; &quot; Y</text>
        </page>
        `,

        [
          {
            title: "Alpha",
            text: "X & < > ' \" Y"
          }
        ]
      ));
  });

  describe("within a container block", () => {
    it("should extract a single page", () =>
      expectWikiPages(
        `
        <wiki>
          <someTag>Hola!</someTag>

          <page>
            <title>Alpha</title>
            <text>This is the text!</text>
          </page>

          <someClosingTag>Z</someClosingTag>
        </wiki>
        `,

        [
          {
            title: "Alpha",
            text: "This is the text!"
          }
        ]
      ));

    it("should extract multiple pages", () =>
      expectWikiPages(
        `
        <wiki>
          <someTag>Hola!</someTag>

          <page>
            <title>Alpha</title>
            <someProp>A</someProp>
            <text>First text</text>
          </page>

          <page>
            <text>Second text</text>
            <someOtherProp>B</someOtherProp>
            <title>Beta</title>
          </page>

          <page>
            <yetAnotherProp>C</yetAnotherProp>
            <title>Gamma</title>
            <text>Third text</text>
          </page>

          <someClosingTag>Z</someClosingTag>
        </wiki>
        `,

        [
          { title: "Alpha", text: "First text" },
          { title: "Beta", text: "Second text" },
          { title: "Gamma", text: "Third text" }
        ]
      ));

    describe("when a page is without title", () => {
      it("should just log it and continue parsing", async () => {
        const logger = await expectWikiPages(
          `
          <wiki>
            <someTag>Hola!</someTag>

            <page>
              <title>Alpha</title>
              <someProp>A</someProp>
              <text>First text</text>
            </page>

            <page>
              <someProp>B</someProp>
              <text>THIS PAGE HAS NO TITLE!</text>
            </page>

            <page>
              <title>Gamma</title>
              <text>Third text</text>
              <yetAnotherProp>C</yetAnotherProp>
            </page>

            <someClosingTag>Z</someClosingTag>
          </wiki>
          `,
          [
            { title: "Alpha", text: "First text" },
            { title: "Gamma", text: "Third text" }
          ]
        );

        expect(logger.infoMessages).toEqual(["Page without title!"]);
      });
    });

    describe("when a page is without text", () => {
      it("should just log it and continue parsing", async () => {
        const logger = await expectWikiPages(
          `
          <wiki>
            <someTag>Hola!</someTag>

            <page>
              <title>Alpha</title>
              <someProp>A</someProp>
              <text>First text</text>
            </page>

            <page>
              <title>Beta</title>
              <someProp>THIS PAGE HAS NO TEXT!</someProp>
            </page>

            <page>
              <title>Gamma</title>
              <text>Third text</text>
              <yetAnotherProp>C</yetAnotherProp>
            </page>

            <someClosingTag>Z</someClosingTag>
          </wiki>
          `,
          [
            { title: "Alpha", text: "First text" },
            { title: "Gamma", text: "Third text" }
          ]
        );

        expect(logger.infoMessages).toEqual(["Page 'Beta' has no text!"]);
      });
    });
  });

  it("should be manually controllable", async () => {
    const wikiTransform = new WikiTransform();

    const pages: WikiPage[] = [];

    await new Promise<void>((resolve, reject) => {
      wikiTransform.on("data", (page: WikiPage) => pages.push(page));

      wikiTransform.on("end", resolve);

      wikiTransform.on("error", reject);

      wikiTransform.write("<wiki>");

      wikiTransform.write(
        `
        <page>
          <title>Alpha</title>
          <text>This is the text!</text>
        </page>
        `
      );

      [
        "<page>",
        "<title>",
        "B",
        "et",
        "a",
        "</ti",
        "tle",
        ">",
        "  ",
        "<te",
        "xt>",
        "More text! ^__^",
        "</",
        "text>",
        "</page>"
      ].forEach(chunk => wikiTransform.write(chunk));

      wikiTransform.end("</wiki>");
    });

    expect(pages).toEqual<WikiPage[]>([
      {
        title: "Alpha",
        text: "This is the text!"
      },
      {
        title: "Beta",
        text: "More text! ^__^"
      }
    ]);
  });

  describe("when the XML is invalid", () => {
    it("should log at least once, and emit an error event", async () => {
      const logger = new ArrayLogger();

      await new Promise<void>(resolve => {
        const wikiTransform = new WikiTransform({ logger }).on(
          "error",
          resolve
        );

        wikiTransform.end("INVALID XML");
      });

      expect(logger.errorMessages.length).toBeGreaterThan(0);
    });
  });
});
