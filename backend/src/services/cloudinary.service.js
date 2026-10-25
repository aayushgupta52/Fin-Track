import { v2 as cloudinary } from 'cloudinary';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/response.js';

const configured = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret
);

if (configured) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
  logger.info('[storage] Cloudinary configured');
} else {
  logger.warn('[storage] Cloudinary not configured — local file storage is used where permitted');
}

export const isCloudConfigured = () => configured;

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const UPLOAD_DIR = env.uploadDir ? path.resolve(env.uploadDir) : path.join(BACKEND_DIR, 'uploads');
const LOCAL_PREFIX = 'local://';

const CLOUDINARY_REF_PREFIX = 'cloudinary://asset/';
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const encodeCloudinaryReference = ({ publicId, resourceType, format }) => {
  const payload = Buffer.from(JSON.stringify({ publicId, resourceType, format })).toString('base64url');
  return `${CLOUDINARY_REF_PREFIX}${payload}`;
};

const decodeCloudinaryReference = (value) => {
  const encoded = value.slice(CLOUDINARY_REF_PREFIX.length);
  if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) {
    throw new Error('Stored Cloudinary reference is invalid');
  }

  let reference;
  try {
    reference = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Stored Cloudinary reference is invalid');
  }

  const { publicId, resourceType, format } = reference || {};
  if (
    typeof publicId !== 'string' ||
    !publicId.startsWith('fintrack/') ||
    publicId.length > 255 ||
    !/^[A-Za-z0-9_./-]+$/.test(publicId) ||
    publicId.includes('..') ||
    !['image', 'raw'].includes(resourceType) ||
    typeof format !== 'string' ||
    !/^[A-Za-z0-9]{1,10}$/.test(format)
  ) {
    throw new Error('Stored Cloudinary reference is invalid');
  }

  return { publicId, resourceType, format };
};

const uploadToCloudinary = (buffer, { fileType }) =>
  new Promise((resolve, reject) => {
    const resourceType = fileType === 'pdf' ? 'raw' : 'image';
    // Bank statements and receipts are private financial documents: use
    // authenticated delivery so neither originals nor derivatives are public.
    const publicId = `fintrack/${randomUUID()}${resourceType === 'raw' ? '.pdf' : ''}`;

    cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        type: 'authenticated',
        public_id: publicId,
        overwrite: false,
        unique_filename: false,
        use_filename: false,
      },
      (err, result) => {
        if (err) return reject(err);
        if (!result?.public_id || !result?.format || !result?.resource_type) {
          return reject(new Error('Cloudinary returned an incomplete upload result'));
        }
        resolve({
          url: encodeCloudinaryReference({
            publicId: result.public_id,
            resourceType: result.resource_type,
            format: result.format,
          }),
          publicId: result.public_id,
        });
      }
    ).end(buffer);
  });

const fetchStoredFile = async (remote, { allowedHosts }) => {
  if (remote.protocol !== 'https:' || !allowedHosts.has(remote.hostname)) {
    throw new Error('Stored document URL is not from the configured file-storage provider');
  }
  const res = await fetch(remote, { signal: AbortSignal.timeout(20000), redirect: 'error' });
  if (!res.ok) throw new Error(`Failed to download stored file (${res.status})`);
  const contentLength = Number(res.headers.get('content-length') || 0);
  if (contentLength > MAX_FILE_BYTES) throw new Error('Stored file exceeds the 10MB processing limit');
  if (!res.body) throw new Error('Stored file response had no body');
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_FILE_BYTES) {
        await reader.cancel();
        throw new Error('Stored file exceeds the 10MB processing limit');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
};

const uploadLocally = async (buffer, { filename }) => {
  await fs.mkdir(UPLOAD_DIR, { recursive: true, mode: 0o700 });
  const cleaned = path.basename(String(filename || 'upload')).replace(/[^\w.\-]/g, '_').slice(-120) || 'upload';
  const storedName = `${Date.now()}-${randomUUID()}-${cleaned}`;
  await fs.writeFile(path.join(UPLOAD_DIR, storedName), buffer, { flag: 'wx', mode: 0o600 });
  return { url: `${LOCAL_PREFIX}${storedName}`, publicId: null };
};

export const uploadFile = async (buffer, { filename, fileType }) => {
  if (configured) {
    try {
      return await uploadToCloudinary(buffer, { fileType });
    } catch (err) {
      if (env.nodeEnv === 'production' && !env.uploadDir) {
        logger.error(`[storage] Cloudinary upload failed and no persistent UPLOAD_DIR is configured: ${err.message}`);
        throw new ApiError(503, 'File storage is temporarily unavailable. Please try again later.');
      }
      logger.warn(`[storage] Cloudinary upload failed; using ${env.nodeEnv === 'production' ? 'configured persistent' : 'local development'} storage: ${err.message}`);
    }
  } else if (env.nodeEnv === 'production' && !env.uploadDir) {
    throw new ApiError(503, 'File storage is not configured. Set Cloudinary credentials or a persistent UPLOAD_DIR.');
  }

  return uploadLocally(buffer, { filename });
};

export const downloadFile = async (url) => {
  if (typeof url !== 'string' || !url) throw new Error('Stored document URL is invalid');

  if (url.startsWith(LOCAL_PREFIX)) {
    const name = url.slice(LOCAL_PREFIX.length);
    if (!name || name !== path.basename(name) || name.includes('..')) {
      throw new Error('Stored local document reference is invalid');
    }
    const root = path.resolve(UPLOAD_DIR);
    const fullPath = path.resolve(root, name);
    const relative = path.relative(root, fullPath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Stored local document reference is invalid');
    }
    const buffer = await fs.readFile(fullPath);
    if (buffer.byteLength > MAX_FILE_BYTES) throw new Error('Stored file exceeds the 10MB processing limit');
    return buffer;
  }

  if (url.startsWith(CLOUDINARY_REF_PREFIX)) {
    if (!configured) throw new Error('Cloudinary is not configured to access this stored document');
    const { publicId, resourceType, format } = decodeCloudinaryReference(url);
    const expiresAt = Math.floor(Date.now() / 1000) + 600;
    const signedUrl = cloudinary.utils.private_download_url(publicId, format, {
      resource_type: resourceType,
      type: 'authenticated',
      expires_at: expiresAt,
      attachment: false,
    });
    const remote = new URL(signedUrl);
    return fetchStoredFile(remote, { allowedHosts: new Set(['api.cloudinary.com']) });
  }

  // Backwards compatibility for existing uploads that were stored as public
  // Cloudinary URLs before authenticated asset references were introduced.
  const remote = new URL(url);
  return fetchStoredFile(remote, { allowedHosts: new Set(['res.cloudinary.com']) });
};
