import type { ArticleBody } from '../index'

export const article: ArticleBody = {
  title: '12 document scan-to-PDF guides — no scanner needed (2026)',
  description:
    'A 2026 walkthrough of all 12 built-in Pixfit Scanner document types: ID cards, driver licenses, vehicle licenses, passport bio pages, and plain paper, with the right size for each.',
  sections: [
    {
      heading: 'Why scan in the browser at all?',
      blocks: [
        {
          type: 'p',
          text: 'In 2026 most government and bank portals still ask for "a scanned PDF" even though almost no household actually owns a flatbed scanner anymore. Phone photos technically work, but they show keystone distortion, hand shadows, and reflections from the laminate on top of the card. Pixfit\'s Scanner removes all three problems in the browser: it detects the rectangle of the document, rectifies it to a true top-down view, normalises the lighting, and exports a single multi-page PDF at 300 DPI. No upload, no server, no scanner.',
        },
        {
          type: 'p',
          text: 'The Scanner ships with 12 built-in document presets in v1, each with the correct physical millimetre size pre-loaded. Pick the preset, snap one or two photos, download the PDF. The rest of this article walks every preset top-to-bottom so you know which one matches your document.',
        },
      ],
    },
    {
      heading: 'ID cards (ISO/IEC 7810 ID-1, 85.6×54 mm)',
      intro:
        'These six presets all share the CR80 dimensions, which is the same physical size as a credit card. Front and back scan into a single 2-page PDF.',
      blocks: [
        {
          type: 'list',
          items: [
            'PRC Resident ID (`cn-id-card`) — 85.6×54 mm. The default and the highest-volume preset. Front shows the photo + name; back shows the validity and the issuing authority.',
            'Hong Kong Smart ID (`hk-id-card`) — 85.6×54 mm. Same physical card as the PRC ID; the preset is provided separately so the Pixfit copy and OCR hints can reference the HK-specific layout.',
            'Taiwan ID card (`tw-id-card`) — 85.6×54 mm. The 2020-redesign card; the layout differs from PRC and HK but the physical size is identical.',
            'Singapore NRIC (`sg-nric`) — 85.6×54 mm. The "pink" or "blue" NRIC; both scan to the same preset.',
            'India Aadhaar card (`in-aadhaar`) — 85.6×54 mm. The plastic Aadhaar card (not the paper letter, which is A4-sized and uses the `a4` preset).',
            'Bank / credit card (`bank-card`) — 85.6×54 mm. For uploading proof-of-card-ownership scans to fraud / chargeback teams.',
          ],
        },
        {
          type: 'p',
          text: 'How to scan: place the card on a dark, matte surface (a black notebook works) and shoot from directly overhead under indirect daylight. The dark background helps the rectangle detector lock onto the card edges. Then upload front, flip, upload back. Pixfit produces a single A4-sized PDF with both faces stacked at the correct ratio.',
        },
      ],
    },
    {
      heading: 'Driver licenses',
      blocks: [
        {
          type: 'list',
          items: [
            'US driver license (`us-driver-license`) — 85.6×54 mm. The AAMVA-standard plastic card. Use the same workflow as a bank card; the preset is identical except for the i18n labels.',
            'PRC driver license (`cn-driver-license`) — 88×60 mm. Slightly larger than CR80 — this is the booklet-style license issued before the 2024 plastic-card transition. Both pages of the inside spread scan into a 2-page PDF.',
          ],
        },
      ],
    },
    {
      heading: 'Vehicle licenses',
      blocks: [
        {
          type: 'list',
          items: [
            'PRC vehicle license (`cn-vehicle-license`) — 88×60 mm. The 行驶证 booklet. Front shows the vehicle plate + VIN; back shows owner + colour. Pixfit handles both as one document.',
          ],
        },
      ],
    },
    {
      heading: 'Passport bio page',
      blocks: [
        {
          type: 'list',
          items: [
            "Generic passport bio page (`passport-bio`) — ISO/IEC 7810 ID-3, 125×88 mm. Single-sided. Use this preset for any passport in the world; the rectifier doesn't care which country issued it.",
          ],
        },
        {
          type: 'p',
          text: 'Tip: open the passport flat under good lighting and avoid pressing on the centre crease. The Scanner rectifier handles a small amount of paper curl, but anything beyond about 5 degrees per side starts to introduce optical errors.',
        },
      ],
    },
    {
      heading: 'Plain paper at standard sizes',
      blocks: [
        {
          type: 'list',
          items: [
            'A4 (`a4`) — 210×297 mm. Use for tax filings, contracts, receipts, and anything else printed on A4 in most of the world.',
            'US Letter (`letter`) — 215.9×279.4 mm. Use this for US receipts, contracts, and tax documents.',
          ],
        },
        {
          type: 'p',
          text: 'For multi-page paper documents, take one photo per page and the Scanner stitches them into a single PDF in upload order. Drag the thumbnails in the side panel to reorder before exporting.',
        },
      ],
    },
    {
      heading: 'Export options that matter',
      blocks: [
        {
          type: 'p',
          text: 'Every preset exports to PDF at 300 DPI by default. That matches what most government portals expect — 600 DPI is rejected for being too large, 200 DPI is rejected for being too fuzzy. You can also export individual pages as JPG or PNG if a portal asks for image files instead.',
        },
        {
          type: 'p',
          text: "If the destination has a hard file-size cap (banks love 2 MB, some government portals demand under 500 KB), open the Studio export tab afterwards and run the PDF through Pixfit's compress pipeline. The /compress/[target] landing pages have pre-built presets for 50 KB / 100 KB / 200 KB / 500 KB / 1 MB.",
        },
      ],
    },
    {
      heading: 'Tips that improve every scan',
      blocks: [
        {
          type: 'list',
          items: [
            'Use a dark matte background — black paper or a dark wooden table works best. Rectangle detection is more reliable with high contrast.',
            'Avoid direct sunlight. Diffuse north-window daylight is the cleanest. Avoid yellow tungsten lamps because they tint the document.',
            'Shoot from directly above. The Scanner can correct up to about 30 degrees of skew, but the closer you are to top-down, the sharper the output.',
            'For laminated cards, tilt the card 1-2 degrees to avoid a direct reflection of the camera lens. The rectifier will straighten it back out.',
            'Wipe the lens. A smudged phone camera is the single biggest source of fuzzy scans.',
          ],
        },
      ],
    },
  ],
  closing:
    'All 12 presets live at /scanner and each has its own landing page (e.g. /scanner/cn-id-card) with the per-document SEO copy and a deep-link straight into the Scanner with that preset selected. No upload. No account. The PDF stays on your machine.',
}
