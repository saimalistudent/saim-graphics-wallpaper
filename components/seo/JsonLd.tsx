type JsonLdProps = {
  data: Record<string, unknown> | Record<string, unknown>[];
};

/** Invisible structured data only — never renders visible UI. */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
