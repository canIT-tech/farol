import { serializeJsonLd } from "../../lib/seo";

// Um <script type="application/ld+json"> por bloco: o Google valida cada
// entidade separada, e um bloco quebrado não derruba os outros.
export function JsonLd({ data }: { data: readonly unknown[] }) {
  return (
    <>
      {data.map((item, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(item) }}
        />
      ))}
    </>
  );
}
