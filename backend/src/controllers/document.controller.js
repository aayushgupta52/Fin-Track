import { prisma } from '../config/prisma.js';
import { ok, created, asyncHandler, ApiError } from '../utils/response.js';
import { uploadFile } from '../services/cloudinary.service.js';
import { enqueueDocument } from '../queues/document.queue.js';
import { writeAuditLog } from '../middleware/audit.js';

const fileTypeFromMime = (mime) => (mime === 'application/pdf' ? 'pdf' : 'image');

const matchesFileSignature = (buffer, mime) => {
  if (mime === 'application/pdf') return buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'));
  if (mime === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === 'image/jpeg' || mime === 'image/jpg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'image/webp') return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  return false;
};

const safeOriginalName = (name) => {
  const base = String(name || 'statement').split(/[\\/]/).pop();
  return base.replace(/[^\w.() -]/g, '_').slice(0, 160) || 'statement';
};

// POST /api/documents/upload — multipart "file" field.
export const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded (expected field "file")');

  if (!matchesFileSignature(req.file.buffer, req.file.mimetype)) {
    throw new ApiError(415, 'File contents do not match the selected type. Upload a valid PDF, PNG, JPG, or WEBP file.');
  }

  const fileType = fileTypeFromMime(req.file.mimetype);
  const fileName = safeOriginalName(req.file.originalname);
  const { url } = await uploadFile(req.file.buffer, {
    filename: fileName,
    fileType,
  });

  const doc = await prisma.document.create({
    data: {
      userId: req.user.id,
      fileUrl: url,
      fileType,
      fileName,
      status: 'pending',
      processingError: null,
    },
  });

  const mode = await enqueueDocument(doc.id);
  writeAuditLog({ req, action: 'document.upload', resource: 'document', resourceId: doc.id });

  return created(res, { document: doc, processing: mode }, 'Upload received — processing started');
});

// GET /api/documents — list the user's uploads, newest first.
export const listDocuments = asyncHandler(async (req, res) => {
  const documents = await prisma.document.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      status: true,
      transactionsFound: true,
      processedAt: true,
      processingError: true,
      createdAt: true,
    },
  });
  return ok(res, { documents });
});

// GET /api/documents/:id/status — lightweight polling endpoint.
export const documentStatus = asyncHandler(async (req, res) => {
  const doc = await prisma.document.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true, status: true, transactionsFound: true, processedAt: true, processingError: true },
  });
  if (!doc) throw new ApiError(404, 'Document not found');
  return ok(res, { document: doc });
});

// POST /api/documents/:id/reprocess — re-run the pipeline on an existing doc.
export const reprocessDocument = asyncHandler(async (req, res) => {
  const doc = await prisma.document.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true, status: true, processingError: true },
  });
  if (!doc) throw new ApiError(404, 'Document not found');
  if (doc.status === 'pending' || doc.status === 'processing') {
    throw new ApiError(409, 'This document is already being processed. Please wait for it to finish.');
  }
  if (doc.status === 'done' && !doc.processingError) {
    throw new ApiError(409, 'This document has already been processed. Retry only failed or review-required uploads.');
  }

  await prisma.document.update({
    where: { id: doc.id },
    data: { status: 'pending', transactionsFound: 0, processedAt: null, processingError: null },
  });
  const mode = await enqueueDocument(doc.id);
  writeAuditLog({ req, action: 'document.reprocess', resource: 'document', resourceId: doc.id });

  return ok(res, { document: { id: doc.id, status: 'pending' }, processing: mode }, 'Reprocessing started');
});
