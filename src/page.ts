import { DEFAULT_PAGE_TAG } from "./core";

export type WikiPage = Readonly<{
  title: string;
  text: string;
}>;

export type WikiPageToXmlOptions = {
  pageTag?: string;
};

export function wikiPageToXml(
  page: WikiPage,
  options?: WikiPageToXmlOptions
): string {
  const pageTag = options?.pageTag ?? DEFAULT_PAGE_TAG;

  return `<${pageTag}>
  <title><![CDATA[${page.title}]]></title>
  <text><![CDATA[${page.text}]]></text>
</${pageTag}>`;
}
