import { type JsonLdObject, serializeJsonLd } from '@/lib/seo/jsonld'

interface JsonLdProps {
  data: JsonLdObject | JsonLdObject[]
}

export function JsonLd({ data }: JsonLdProps) {
  const entries = Array.isArray(data) ? data : [data]
  return (
    <>
      {entries.map((entry, idx) => (
        <script
          key={idx}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(entry) }}
        />
      ))}
    </>
  )
}
