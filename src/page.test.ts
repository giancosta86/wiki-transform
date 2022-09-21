import { DEFAULT_PAGE_TAG } from "./core";
import { WikiPage, wikiPageToXml, WikiPageToXmlOptions } from "./page";
import { WikiTransform } from "./transform";

async function expectPageConversion(
  page: WikiPage,
  options?: WikiPageToXmlOptions
): Promise<void> {
  const xml = wikiPageToXml(page, options);

  const parsedPage = await new Promise<WikiPage>((resolve, reject) => {
    const wikiTransform = new WikiTransform({
      logger: console,
      pageTag: options?.pageTag
    })
      .on("error", reject)
      .on("data", resolve);

    wikiTransform.end(xml);
  });

  const openingTagRegex = new RegExp(
    `^<${options?.pageTag ?? DEFAULT_PAGE_TAG}>`
  );

  expect(xml).toMatch(openingTagRegex);
  expect(parsedPage).toEqual(page);
}

describe("Converting a wiki page to XML", () => {
  describe("when all the page fields contain plain characters", () => {
    it("should work", () =>
      expectPageConversion({
        title: "Yellowstone bears",
        text: "Yogi and Bubu"
      }));
  });

  describe("when the page fields also contain XML characters to escape", () => {
    it("should work", () =>
      expectPageConversion({
        title: "> 'Yellowstone bears' <",
        text: '"Yogi & Bubu"'
      }));
  });

  it("should support a custom page tag", () => {
    expectPageConversion(
      { title: "Alpha", text: "Beta" },
      { pageTag: "article" }
    );
  });
});
