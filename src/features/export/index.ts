/**
 * Public surface of the export feature.
 *
 * The UI imports from `@/features/export`, never reaches into the
 * submodules directly. Keeping a flat barrel means M6 can swap in a
 * different filename builder or resampler without touching the
 * panel implementation.
 */

export { buildFilename, formatDate, type ExportExt, type FilenameOpts } from './filename'
export {
  exportSingle,
  mimeFor,
  preservesAlpha,
  canvasToBlob,
  type ExportFormat,
  type ExportOptions,
  type ExportResult,
} from './export-single'
export {
  compressToKB,
  type CompressFormat,
  type CompressOptions,
  type CompressResult,
} from './compress-to-kb'
export { resample, toHtmlCanvas, type ResampleOptions } from './resample'
export { triggerDownload } from './dom-download'
