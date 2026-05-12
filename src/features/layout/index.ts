/**
 * Public surface of the layout feature.
 *
 * UI imports from `@/features/layout`. Internal helpers (cut-guides,
 * resolve-cells) are not re-exported so they can be refactored
 * without affecting consumers.
 */

export {
  packAutoGrid,
  gridCells,
  gridCellsToCapacity,
  type GridFit,
  type GridOptions,
} from './auto-grid'
export { packMixed, resolveLayoutCells, type MixedItem, type MixedResult } from './pack-mixed'
export { renderLayout, type RenderLayoutOptions, type RenderLayoutResult } from './render-layout'
export { exportLayoutPdf, type PdfExportOptions, type PdfExportResult } from './export-pdf'
export { drawCutGuides, drawSeparator, drawPdfCutGuides } from './cut-guides'
export { useLayoutStore } from './store'
export { LayoutPanel } from './layout-panel'
export { LayoutPreview } from './layout-preview'
