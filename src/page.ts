export type WikiPage = Readonly<{
  title: string;
  text: string;
}>;

export function wikiPageToXml(page: WikiPage): string {
  return `<page>
  <title><![CDATA[${page.title}]]></title>
  <text><![CDATA[${page.text}]]></text>
</page>`;
}
