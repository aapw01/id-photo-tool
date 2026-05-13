/**
 * Built-in PhotoSpec library — first edition.
 *
 * 28 specs grouped into five categories:
 *
 *   - cn-id        7  domestic Chinese ID photos
 *   - cn-paper     2  Chinese wallet-photo formats
 *   - travel-permit 2 H/M & Taiwan compatriot permits
 *   - visa        14  visas from the most common destinations
 *   - exam         3  Chinese national exam registration photos
 *
 * Sources:
 *   - PRD §9.1.3 (canonical list)
 *   - Travel.state.gov, EU regulation 1182/2010, MFA HK / Taipei
 *   - National civil-service / NCRE / postgraduate exam announcements
 *
 * Hex values for `background.recommended`:
 *   - White       #FFFFFF   the de-facto visa standard
 *   - Light gray  #DCDCDC   UK visa per gov.uk
 *   - Visa blue   #438EDB   for the few specs that ask for blue
 *
 * Pixel dimensions come from the official spec when given; otherwise
 * derived via `mmToPx`. `derivePixels()` (see `lib/spec-units.ts`)
 * fills in the rest at read time.
 */

import type { PhotoSpec } from '@/types/spec'

const WHITE = '#FFFFFF'
const LIGHT_GRAY = '#DCDCDC'
const LIGHT_BLUE = '#D8E2EC'
const VISA_BLUE = '#438EDB'
const ID_RED = '#D9342B'
const CREAM = '#F5F5DC'

const i18n = (zh: string, zhHant: string, en: string) => ({ zh, 'zh-Hant': zhHant, en })

export const BUILTIN_PHOTO_SPECS: PhotoSpec[] = [
  /* ----------------------------------------------------------------------- */
  /* China — IDs and common sizes                                             */
  /* ----------------------------------------------------------------------- */
  {
    id: 'cn-1inch',
    builtin: true,
    category: 'cn-id',
    region: 'CN',
    name: i18n('一寸照', '一吋照', '1-inch'),
    width_mm: 25,
    height_mm: 35,
    dpi: 300,
    width_px: 295,
    height_px: 413,
    background: { recommended: WHITE, allowed: ['#438EDB', '#D9342B'] },
    composition: { headHeightRatio: [0.6, 0.75], eyeLineFromTop: [0.3, 0.42] },
  },
  {
    id: 'cn-1inch-small',
    builtin: true,
    category: 'cn-id',
    region: 'CN',
    name: i18n('小一寸', '小一吋', 'Small 1-inch'),
    width_mm: 22,
    height_mm: 32,
    dpi: 300,
    width_px: 260,
    height_px: 378,
    background: { recommended: WHITE, allowed: ['#438EDB'] },
    composition: { headHeightRatio: [0.6, 0.75], eyeLineFromTop: [0.3, 0.42] },
  },
  {
    id: 'cn-1inch-large',
    builtin: true,
    category: 'cn-id',
    region: 'CN',
    name: i18n('大一寸', '大一吋', 'Large 1-inch'),
    width_mm: 33,
    height_mm: 48,
    dpi: 300,
    width_px: 390,
    height_px: 567,
    background: { recommended: WHITE, allowed: ['#438EDB'] },
    composition: { headHeightRatio: [0.6, 0.75], eyeLineFromTop: [0.3, 0.42] },
  },
  {
    id: 'cn-2inch',
    builtin: true,
    category: 'cn-id',
    region: 'CN',
    name: i18n('二寸照', '二吋照', '2-inch'),
    width_mm: 35,
    height_mm: 49,
    dpi: 300,
    width_px: 413,
    height_px: 579,
    background: { recommended: WHITE, allowed: ['#438EDB', '#D9342B'] },
    composition: { headHeightRatio: [0.6, 0.72], eyeLineFromTop: [0.3, 0.42] },
  },
  {
    id: 'cn-2inch-large',
    builtin: true,
    category: 'cn-id',
    region: 'CN',
    name: i18n('大二寸', '大二吋', 'Large 2-inch'),
    width_mm: 35,
    height_mm: 53,
    dpi: 300,
    width_px: 413,
    height_px: 626,
    background: { recommended: WHITE, allowed: ['#438EDB'] },
    composition: { headHeightRatio: [0.58, 0.7], eyeLineFromTop: [0.3, 0.42] },
  },
  {
    id: 'cn-id-card',
    builtin: true,
    category: 'cn-id',
    region: 'CN',
    name: i18n('二代身份证', '二代身分證', 'Chinese ID card'),
    description: i18n(
      'GA/T 461-2019 公安部数字相片标准',
      'GA/T 461-2019 公安部數位相片標準',
      'GA/T 461-2019',
    ),
    width_mm: 26,
    height_mm: 32,
    dpi: 350,
    width_px: 358,
    height_px: 441,
    background: { recommended: WHITE },
    fileRules: { minKB: 10, maxKB: 100, formats: ['jpg'] },
    composition: { headHeightRatio: [0.6, 0.7], eyeLineFromTop: [0.35, 0.45] },
    reference: 'https://www.mps.gov.cn/',
  },
  {
    id: 'cn-passport',
    builtin: true,
    category: 'cn-id',
    region: 'CN',
    name: i18n('中国护照', '中國護照', 'Chinese passport'),
    description: i18n(
      '出入境证件数字相片技术标准 · 白 / 浅灰 / 淡蓝底均可',
      '出入境證件數位相片技術標準 · 白 / 淺灰 / 淡藍底均可',
      'Exit-entry digital photo standard · white / light grey / light blue OK',
    ),
    width_mm: 33,
    height_mm: 48,
    dpi: 300,
    width_px: 390,
    height_px: 567,
    background: { recommended: WHITE, allowed: [LIGHT_GRAY, LIGHT_BLUE] },
    fileRules: { minKB: 20, maxKB: 80, formats: ['jpg'] },
    composition: { headHeightRatio: [0.62, 0.71], eyeLineFromTop: [0.27, 0.43] },
    reference: 'https://www.bzztc.cn/xxtd/Document/jsbz/page_11.html',
  },

  /* ----------------------------------------------------------------------- */
  /* China — common wallet-photo paper sizes                                  */
  /* ----------------------------------------------------------------------- */
  {
    id: 'cn-wallet-small',
    builtin: true,
    category: 'cn-paper',
    region: 'CN',
    name: i18n('小皮夹照', '小皮夾照', 'Small wallet photo'),
    width_mm: 63,
    height_mm: 89,
    dpi: 300,
    width_px: 748,
    height_px: 1050,
    background: { recommended: WHITE },
  },
  {
    id: 'cn-wallet-large',
    builtin: true,
    category: 'cn-paper',
    region: 'CN',
    name: i18n('大皮夹照', '大皮夾照', 'Large wallet photo'),
    width_mm: 76,
    height_mm: 102,
    dpi: 300,
    width_px: 898,
    height_px: 1200,
    background: { recommended: WHITE },
  },

  /* ----------------------------------------------------------------------- */
  /* Travel permits                                                           */
  /* ----------------------------------------------------------------------- */
  {
    id: 'permit-hk-macao',
    builtin: true,
    category: 'travel-permit',
    region: 'CN',
    name: i18n('港澳通行证', '港澳通行證', 'HK/Macao permit'),
    width_mm: 33,
    height_mm: 48,
    dpi: 300,
    width_px: 390,
    height_px: 567,
    background: { recommended: WHITE, allowed: [LIGHT_GRAY, LIGHT_BLUE] },
    fileRules: { minKB: 20, maxKB: 80, formats: ['jpg'] },
    composition: { headHeightRatio: [0.62, 0.71], eyeLineFromTop: [0.27, 0.43] },
  },
  {
    id: 'permit-taiwan',
    builtin: true,
    category: 'travel-permit',
    region: 'CN',
    name: i18n('台湾通行证', '台灣通行證', 'Taiwan permit'),
    width_mm: 33,
    height_mm: 48,
    dpi: 300,
    width_px: 390,
    height_px: 567,
    background: { recommended: WHITE, allowed: [LIGHT_GRAY, LIGHT_BLUE] },
    fileRules: { minKB: 20, maxKB: 80, formats: ['jpg'] },
    composition: { headHeightRatio: [0.62, 0.71], eyeLineFromTop: [0.27, 0.43] },
  },

  /* ----------------------------------------------------------------------- */
  /* Visas                                                                    */
  /* ----------------------------------------------------------------------- */
  {
    id: 'us-visa',
    builtin: true,
    category: 'visa',
    region: 'US',
    name: i18n('美国签证', '美國簽證', 'US visa'),
    description: i18n('travel.state.gov 标准', 'travel.state.gov 標準', 'travel.state.gov'),
    width_mm: 51,
    height_mm: 51,
    dpi: 300,
    width_px: 600,
    height_px: 600,
    background: { recommended: WHITE },
    // travel.state.gov digital image: 600×600 to 1200×1200, JPEG ≤240 KB
    fileRules: {
      maxKB: 240,
      formats: ['jpg'],
      pixelRange: { wMin: 600, wMax: 1200, hMin: 600, hMax: 1200 },
    },
    // Eye line is 1 1/8"–1 3/8" (28–35 mm) from the *bottom*, so the
    // *top*-anchored ratio is (51 − 35)/51 to (51 − 28)/51 = 0.314–0.441.
    // Previous [0.395, 0.527] had the direction reversed and pushed the
    // eyes into the lower half of the frame, rejecting compliant photos.
    composition: { headHeightRatio: [0.5, 0.69], eyeLineFromTop: [0.314, 0.441] },
    reference: 'https://travel.state.gov/content/travel/en/passports/how-apply/photos.html',
  },
  {
    id: 'schengen',
    builtin: true,
    category: 'visa',
    region: 'EU',
    name: i18n('欧洲申根签证', '歐洲申根簽證', 'Schengen visa'),
    description: i18n(
      'EU Regulation 1182/2010',
      'EU Regulation 1182/2010',
      'EU Regulation 1182/2010',
    ),
    width_mm: 35,
    height_mm: 45,
    dpi: 300,
    width_px: 413,
    height_px: 531,
    background: { recommended: WHITE },
    composition: { headHeightRatio: [0.7, 0.8], eyeLineFromTop: [0.3, 0.4] },
  },
  {
    id: 'uk-visa',
    builtin: true,
    category: 'visa',
    region: 'GB',
    name: i18n('英国签证', '英國簽證', 'UK visa'),
    description: i18n('gov.uk 标准（浅灰底）', 'gov.uk 標準（淺灰底）', 'gov.uk standard'),
    width_mm: 35,
    height_mm: 45,
    dpi: 300,
    width_px: 413,
    height_px: 531,
    // gov.uk: "plain cream or light grey background"
    background: { recommended: LIGHT_GRAY, allowed: [WHITE, CREAM] },
    composition: { headHeightRatio: [0.65, 0.8], eyeLineFromTop: [0.3, 0.4] },
    reference: 'https://www.gov.uk/photos-for-passports/photo-requirements',
  },
  {
    id: 'ca-visa',
    builtin: true,
    category: 'visa',
    region: 'CA',
    name: i18n('加拿大签证', '加拿大簽證', 'Canada visa'),
    width_mm: 35,
    height_mm: 45,
    dpi: 300,
    width_px: 413,
    height_px: 531,
    background: { recommended: WHITE },
    composition: { headHeightRatio: [0.65, 0.8], eyeLineFromTop: [0.3, 0.4] },
  },
  {
    id: 'au-visa',
    builtin: true,
    category: 'visa',
    region: 'AU',
    name: i18n('澳大利亚签证', '澳大利亞簽證', 'Australia visa'),
    width_mm: 35,
    height_mm: 45,
    dpi: 300,
    width_px: 413,
    height_px: 531,
    background: { recommended: WHITE },
    // Australian Passport Office: face 32–36 mm chin-to-crown → 71–80%
    composition: { headHeightRatio: [0.7, 0.8], eyeLineFromTop: [0.3, 0.4] },
  },
  {
    id: 'nz-visa',
    builtin: true,
    category: 'visa',
    region: 'NZ',
    name: i18n('新西兰签证', '紐西蘭簽證', 'New Zealand visa'),
    width_mm: 35,
    height_mm: 45,
    dpi: 300,
    width_px: 413,
    height_px: 531,
    background: { recommended: WHITE },
    composition: { headHeightRatio: [0.65, 0.8], eyeLineFromTop: [0.3, 0.4] },
  },
  {
    id: 'jp-visa',
    builtin: true,
    category: 'visa',
    region: 'JP',
    name: i18n('日本签证', '日本簽證', 'Japan visa'),
    width_mm: 45,
    height_mm: 45,
    dpi: 300,
    width_px: 531,
    height_px: 531,
    background: { recommended: WHITE },
    composition: { headHeightRatio: [0.6, 0.7], eyeLineFromTop: [0.3, 0.4] },
  },
  {
    id: 'kr-visa',
    builtin: true,
    category: 'visa',
    region: 'KR',
    name: i18n('韩国签证', '韓國簽證', 'Korea visa'),
    width_mm: 35,
    height_mm: 45,
    dpi: 300,
    width_px: 413,
    height_px: 531,
    background: { recommended: WHITE },
    composition: { headHeightRatio: [0.65, 0.8], eyeLineFromTop: [0.3, 0.4] },
  },
  {
    id: 'sg-visa',
    builtin: true,
    category: 'visa',
    region: 'SG',
    name: i18n('新加坡签证', '新加坡簽證', 'Singapore visa'),
    width_mm: 35,
    height_mm: 45,
    dpi: 300,
    width_px: 413,
    height_px: 531,
    background: { recommended: WHITE },
    composition: { headHeightRatio: [0.65, 0.8], eyeLineFromTop: [0.3, 0.4] },
  },
  {
    id: 'my-visa',
    builtin: true,
    category: 'visa',
    region: 'MY',
    name: i18n('马来西亚签证', '馬來西亞簽證', 'Malaysia visa'),
    description: i18n(
      '马签需蓝底（与马护照白底不同）',
      '馬簽需藍底（與馬護照白底不同）',
      'Visa requires blue background (different from passport)',
    ),
    width_mm: 35,
    height_mm: 50,
    dpi: 300,
    width_px: 413,
    height_px: 590,
    // kln.gov.my: visa applications require "blue background"; this is a
    // common rejection reason because applicants assume the passport's
    // white background applies. Passport / IC photos are still white.
    background: { recommended: VISA_BLUE, allowed: [WHITE] },
    composition: { headHeightRatio: [0.6, 0.75], eyeLineFromTop: [0.3, 0.4] },
    reference: 'https://www.kln.gov.my/',
  },
  {
    id: 'vn-visa-arrival',
    builtin: true,
    category: 'visa',
    region: 'VN',
    name: i18n('越南落地签', '越南落地簽', 'Vietnam visa-on-arrival'),
    width_mm: 40,
    height_mm: 60,
    dpi: 300,
    width_px: 472,
    height_px: 708,
    background: { recommended: WHITE },
    // visa.mofa.gov.vn: head 32–36 mm of 60 mm frame → 53–60% (legacy
    // floor 0.60 left in to stay tolerant of older guidelines).
    composition: { headHeightRatio: [0.65, 0.75], eyeLineFromTop: [0.3, 0.4] },
  },
  {
    id: 'th-visa-arrival',
    builtin: true,
    category: 'visa',
    region: 'TH',
    name: i18n('泰国落地签', '泰國落地簽', 'Thailand visa-on-arrival'),
    width_mm: 40,
    height_mm: 60,
    dpi: 300,
    width_px: 472,
    // Thailand e-VOA portal specifies 472×709 (the +1 px comes from
    // rounding 60mm × 300 / 25.4 = 708.66 up rather than down).
    height_px: 709,
    background: { recommended: WHITE },
    fileRules: { maxKB: 120, formats: ['jpg'] },
    // Thai immigration: head 70–75% of photo
    composition: { headHeightRatio: [0.7, 0.75], eyeLineFromTop: [0.3, 0.4] },
  },
  {
    id: 'ru-visa',
    builtin: true,
    category: 'visa',
    region: 'RU',
    name: i18n('俄罗斯签证', '俄羅斯簽證', 'Russia visa'),
    width_mm: 35,
    height_mm: 45,
    dpi: 300,
    width_px: 413,
    height_px: 531,
    background: { recommended: WHITE },
    // Russian MFA consular: head ~33 mm, occupying 70–80% of the photo
    composition: { headHeightRatio: [0.7, 0.8], eyeLineFromTop: [0.3, 0.4] },
  },
  {
    id: 'in-visa',
    builtin: true,
    category: 'visa',
    region: 'IN',
    name: i18n('印度签证', '印度簽證', 'India visa'),
    description: i18n(
      'indianvisaonline.gov.in 标准',
      'indianvisaonline.gov.in 標準',
      'indianvisaonline.gov.in',
    ),
    width_mm: 51,
    height_mm: 51,
    dpi: 300,
    width_px: 600,
    height_px: 600,
    background: { recommended: WHITE },
    fileRules: { minKB: 10, maxKB: 300, formats: ['jpg'] },
    // Same chin-to-crown / eye-from-bottom rules as US visa (25–35 mm
    // head, eyes 28–35 mm above the bottom): head 49–69%, eye 31–44%.
    composition: { headHeightRatio: [0.49, 0.69], eyeLineFromTop: [0.31, 0.44] },
    reference: 'https://indianvisaonline.gov.in/visa/instruction.html',
  },

  /* ----------------------------------------------------------------------- */
  /* China — exam registration                                                */
  /* ----------------------------------------------------------------------- */
  {
    id: 'exam-cn-civil',
    builtin: true,
    category: 'exam',
    region: 'CN',
    name: i18n('国家公务员考试', '國家公務員考試', 'National civil service exam'),
    description: i18n(
      '20–100 KB · ≥295×413 · 白 / 蓝底',
      '20–100 KB · ≥295×413 · 白 / 藍底',
      '20–100 KB · ≥295×413 · white or blue background',
    ),
    width_mm: 25,
    height_mm: 35,
    dpi: 300,
    width_px: 295,
    height_px: 413,
    // 2025/2026 国考报名公告允许白底或蓝底
    background: { recommended: WHITE, allowed: [VISA_BLUE] },
    // 历史宽容范围 20–100KB（早期）/ 现行工具多为 ≤20KB；以 20–100 兼容
    // 多数考点，pixelRange 上限放开避免合规照片被误判
    fileRules: {
      minKB: 20,
      maxKB: 100,
      formats: ['jpg'],
      pixelRange: { wMin: 295, wMax: 1024, hMin: 413, hMax: 1280 },
    },
    composition: { headHeightRatio: [0.6, 0.75], eyeLineFromTop: [0.3, 0.42] },
  },
  {
    id: 'exam-cn-ncre',
    builtin: true,
    category: 'exam',
    region: 'CN',
    name: i18n('计算机等级考试 (NCRE)', '電腦等級考試 (NCRE)', 'NCRE'),
    description: i18n(
      '20–200 KB · ≥144×192 · 白 / 浅蓝底',
      '20–200 KB · ≥144×192 · 白 / 淺藍底',
      '20–200 KB · ≥144×192 · white or light blue background',
    ),
    // 上海市教育考试院 2024 NCRE 报名公告明文："成像区大小为 48mm×33mm
    // (高×宽)"，即印片实际尺寸 33×48mm；旧值 12.2×16.3mm 是从最小像素
    // 144×192 反推得到的派生值，并非真实成像尺寸。
    width_mm: 33,
    height_mm: 48,
    dpi: 300,
    width_px: 390,
    height_px: 567,
    background: { recommended: WHITE, allowed: [LIGHT_BLUE] },
    // 官方："照片大小 20KB–200KB"，"最小 192×144 (高×宽)"。旧 spec 把
    // 下限 20 当成 maxKB，且把最小像素当固定值锁死。
    fileRules: {
      minKB: 20,
      maxKB: 200,
      formats: ['jpg'],
      pixelRange: { wMin: 144, wMax: 1024, hMin: 192, hMax: 1280 },
    },
    composition: { headHeightRatio: [0.6, 0.75], eyeLineFromTop: [0.3, 0.42] },
    reference: 'https://www.shmeea.edu.cn/page/05700/20240201/18183.html',
  },
  {
    id: 'exam-cn-postgrad',
    builtin: true,
    category: 'exam',
    region: 'CN',
    name: i18n('全国硕士研究生考试', '全國碩士研究生考試', 'Postgraduate entrance exam'),
    description: i18n(
      '20–100 KB · 3:4 · 白 / 蓝 / 红底',
      '20–100 KB · 3:4 · 白 / 藍 / 紅底',
      '20–100 KB · 3:4 · white / blue / red background',
    ),
    width_mm: 12.7,
    height_mm: 17.8,
    dpi: 300,
    width_px: 150,
    height_px: 210,
    // 研招网："白色 / 蓝色 / 红色"均可，具体以报考点为准
    background: { recommended: WHITE, allowed: [VISA_BLUE, ID_RED] },
    // 研招网官方：JPG，宽 90–480 px，高 100–640 px，3:4，文件大小
    // 20–100 KB 最佳（建议不超过 10M）。旧 maxKB=30 远窄于现行要求。
    fileRules: {
      minKB: 20,
      maxKB: 100,
      formats: ['jpg'],
      pixelRange: { wMin: 90, wMax: 480, hMin: 100, hMax: 640 },
    },
    composition: { headHeightRatio: [0.6, 0.75], eyeLineFromTop: [0.3, 0.42] },
    reference: 'https://yz.chsi.com.cn/',
  },
]

/** Lookup by id. Returns null if unknown. */
export function getPhotoSpec(id: string): PhotoSpec | null {
  return BUILTIN_PHOTO_SPECS.find((s) => s.id === id) ?? null
}
