import { WikiPage, wikiPageToXml } from "./page";
import { WikiTransform } from "./transform";

async function expectPageConversion(page: WikiPage): Promise<void> {
  const xml = wikiPageToXml(page);

  const parsedPage = await new Promise<WikiPage>((resolve, reject) => {
    const wikiTransform = new WikiTransform({ logger: console })
      .on("error", reject)
      .on("data", resolve);

    wikiTransform.end(xml);
  });

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
});
