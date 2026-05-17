import type { ArticleBody } from '../index'

export const article: ArticleBody = {
  title: 'US B1/B2 visa photo requirements 2026: sizes, background, and how to compose',
  description:
    'A 2026 step-by-step guide to the US B1/B2 visa photo: 2×2 inch (51×51 mm) size, white background, head positioning, and how to make one in the browser without uploading.',
  sections: [
    {
      heading: 'The 2026 rules in one paragraph',
      blocks: [
        {
          type: 'p',
          text: 'The US Department of State has not changed its visa photograph specification for B1/B2 (or any other non-immigrant category) in 2026. You still need a 2×2 inch (51×51 mm) color photo, taken within the last six months, on a plain white or off-white background, with your head centred and a neutral expression. The full official rules live on travel.state.gov, but for everyday applicants the four numbers that matter are: 600×600 to 1200×1200 pixels at the smallest, head height between 1 and 1 3/8 inch (25 to 35 mm), eyes between 1 1/8 and 1 3/8 inch (28 to 35 mm) from the bottom, and a file under 240 KB if you upload via the DS-160 form.',
        },
      ],
    },
    {
      heading: 'Print size vs. digital size',
      intro:
        'The visa photo has both a print spec and a digital spec, and consulates check different ones depending on whether you walk in or upload.',
      blocks: [
        {
          type: 'p',
          text: 'For in-person submission (rare in 2026, but still possible at some consulates), the print is exactly 2 inches by 2 inches square. For the online DS-160 form, the pixel dimensions must be square and between 600×600 and 1200×1200 px. The DS-160 portal will reject anything outside this range, even if the print would be perfectly fine.',
        },
        {
          type: 'p',
          text: 'Pixfit ships a built-in US visa preset that handles both at once: it crops the image to a true 51×51 mm at 300 DPI (so the print is correct) and exports a 600×600 px JPG (so the upload is correct). You do not have to remember which spec to hit for which surface.',
        },
      ],
    },
    {
      heading: 'Background: pure white, no shadow',
      blocks: [
        {
          type: 'p',
          text: "The State Department is strict on backgrounds. White or off-white only, no patterns, no scenery, and no shadow on the wall. A pale grey shadow next to your head is the single most common rejection reason in 2026. Two ways to solve this without a studio: shoot against a window during cloudy daylight so the wall behind you is evenly lit, or use Pixfit's AI background replacement to overwrite the entire backdrop with a uniform white after the fact.",
        },
        {
          type: 'p',
          text: 'If you replace the background, double-check that the edges of your hair are clean. The cheapest browser cut-outs leave fringe artifacts that DS-160 reviewers spot immediately. Pixfit uses a U2Net portrait model that runs inside your browser, so you can preview the cut-out at full resolution before exporting.',
        },
      ],
    },
    {
      heading: 'Head position and expression',
      blocks: [
        {
          type: 'p',
          text: 'Face the camera squarely. Both ears should be roughly visible (or, if covered by long hair, the silhouette should still read as front-facing). Eyes open, looking straight into the lens. The State Department wants a natural expression with the mouth closed — a closed-lip smile is allowed, a teeth-baring grin is not.',
        },
        {
          type: 'p',
          text: "Head height (chin to crown) should be 1 to 1 3/8 inch, which is 50-69% of the 2-inch frame. Pixfit's smart crop computes this automatically from the face landmarks; the crop handle uses the detected face to position the chin and the top of the head, so you can drag the photo around and the framing will stay legal as long as you keep your face inside the green guideline.",
        },
      ],
    },
    {
      heading: 'Glasses, head coverings, jewelry',
      intro:
        'The 2025 update to the FAM (Foreign Affairs Manual) tightened a few of these rules. Here is the 2026 state of play.',
      blocks: [
        {
          type: 'list',
          items: [
            "Glasses: Not allowed since November 2016. Take them off, even prescription frames. If you must wear them for medical reasons, bring a signed doctor's letter to the interview.",
            'Religious head coverings: Allowed if worn daily for religious reasons. The full face from the bottom of the chin to the top of the forehead and both edges of the face must still be visible.',
            'Hearing aids: Allowed.',
            'Jewelry / piercings: Allowed if they do not obscure the face. A nose stud is fine; a face-covering veil is not.',
            'Makeup: Allowed.',
          ],
        },
      ],
    },
    {
      heading: 'How to make a US visa photo in your browser (4 steps)',
      blocks: [
        {
          type: 'list',
          ordered: true,
          items: [
            "Open the US visa preset on Pixfit's sizes page — it pre-loads the 51×51 mm / 600×600 px target.",
            'Upload a recent passport-quality portrait. The smart crop will centre your face automatically; drag if you want to fine-tune.',
            'Open the Background tab and pick "Replace with white" to overwrite the backdrop. Preview the edges of your hair at 100% zoom.',
            'Open the Export tab, pick JPG, and set the target file size to under 240 KB. Download the file and upload it directly to DS-160.',
          ],
        },
        {
          type: 'p',
          text: 'The whole flow runs in the browser — no upload, no server, no account. The image never leaves your machine, which matters because some applicants are uncomfortable sending a portrait to an unknown server before it lands on the official consular portal.',
        },
      ],
    },
    {
      heading: 'Most common 2026 rejection reasons',
      blocks: [
        {
          type: 'list',
          items: [
            'Shadow on the wall behind the head — fix with AI background replacement.',
            'Eyes not centred at the correct vertical position — use the smart-crop guideline.',
            'Glasses still on — even slightly tinted lenses count.',
            'Photo older than six months — DS-160 cross-references the upload date.',
            'Smile too wide — keep it neutral.',
            "Compression artifacts from a JPEG saved at very low quality — Pixfit's export pass keeps the file under 240 KB while staying high quality.",
          ],
        },
      ],
    },
    {
      heading: 'Frequently asked questions',
      blocks: [
        {
          type: 'p',
          text: 'Q: Can I use a phone selfie? A: Yes, if the lighting is even and the background is plain. A back-camera shot taken by a friend in cloudy daylight is the easiest setup. Phone front-cameras have wider angles that distort facial proportions; if you do use a front camera, stand a metre back.',
        },
        {
          type: 'p',
          text: 'Q: Does the State Department accept AI-replaced backgrounds? A: The FAM does not specifically prohibit AI editing, but it prohibits "altering the appearance" of the subject. Replacing only the backdrop colour, without modifying the person, is the safe boundary, and that is exactly what Pixfit\'s background tool does — it leaves the portrait pixels untouched and only overwrites the wall.',
        },
        {
          type: 'p',
          text: 'Q: How long does the visa photo stay valid? A: Six months from the date the photo was taken. The DS-160 form does not ask for an exact shoot date, but the consular officer at the interview will spot stale photos.',
        },
      ],
    },
  ],
  closing:
    "When in doubt, the State Department's travel.state.gov photo tool is the source of truth, and Pixfit's 2×2 preset matches it exactly. Make the photo, eyeball it against the guideline, export under 240 KB, upload. The whole process should take under five minutes.",
}
