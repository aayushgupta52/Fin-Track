import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

// Resolve paths relative to this module rather than the shell's working directory.
const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LOCAL_ENG_DATA = path.join(BACKEND_DIR, 'eng.traineddata');

// Extract text from a PDF buffer. Import the library entry directly to avoid
// pdf-parse's optional debug entry trying to read a sample file.
export const extractPdfText = async (buffer) => {
  const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
  const data = await pdfParse(buffer);
  return (data.text || '').trim();
};

// OCR an image buffer. Prefer the bundled English model so first-time OCR does
// not depend on downloading language data from a CDN. Sharp is optional.
export const extractImageText = async (buffer) => {
  let image = buffer;
  try {
    const { default: sharp } = await import('sharp');
    image = await sharp(buffer)
      .rotate()
      .resize({ width: 3000, withoutEnlargement: true })
      .grayscale()
      .normalize()
      .toBuffer();
  } catch (err) {
    logger.warn(`[ocr] image preprocessing skipped: ${err.message}`);
  }

  const { createWorker } = await import('tesseract.js');
  const worker = existsSync(LOCAL_ENG_DATA)
    ? await createWorker('eng', 1, { langPath: BACKEND_DIR, gzip: false })
    : await createWorker('eng');

  try {
    const { data } = await worker.recognize(image);
    return (data.text || '').trim();
  } finally {
    await worker.terminate();
  }
};

export const extractText = async (buffer, fileType) =>
  fileType === 'pdf' ? extractPdfText(buffer) : extractImageText(buffer);
