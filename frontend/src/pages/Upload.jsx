import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { documentApi } from '../services/api.js';
import { formatDate } from '../utils/format.js';

const STATUS_STYLE = {
  pending:
    'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  processing: 'bg-amber-100 text-amber-700',
  done: 'bg-emerald-100 text-emerald-700',
  needs_review: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-700',
};

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp';
const MAX_SIZE = 10 * 1024 * 1024;

const isActive = (status) =>
  status === 'pending' || status === 'processing';

const isRetryable = (doc) =>
  doc.status === 'failed' ||
  doc.status === 'needs_review' ||
  (doc.status === 'done' && Boolean(doc.processingError));

const fileTypes = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const allowedExtensions = /\.(pdf|png|jpe?g|webp)$/i;

export default function Upload() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [retryingId, setRetryingId] = useState(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  const inputRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { documents } = await documentApi.list();

      setDocs(documents || []);
      setLoadError('');

      return documents || [];
    } catch (err) {
      setLoadError(
        err.response?.data?.message ||
          'Could not load your uploads. Check that the backend and database are running.'
      );

      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  useEffect(() => {
    if (!docs.some((doc) => isActive(doc.status))) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      load().catch(() => {});
    }, 3000);

    return () => window.clearInterval(timer);
  }, [docs, load]);

  const handleFiles = async (fileList) => {
    const file = fileList?.[0];

    if (!file) return;

    setError('');

    if (file.size <= 0) {
      setError(
        'The selected file is empty. Choose a PDF or image with content.'
      );
      return;
    }

    if (file.size > MAX_SIZE) {
      setError('File too large. The maximum size is 10 MB.');
      return;
    }

    if (
      !allowedExtensions.test(file.name) ||
      (file.type && !fileTypes.has(file.type))
    ) {
      setError(
        'Unsupported file type. Choose a PDF, PNG, JPG, JPEG, or WEBP file.'
      );
      return;
    }

    setUploading(true);

    try {
      await documentApi.upload(file);
      await load();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Upload failed. Check the backend logs and storage configuration.'
      );
    } finally {
      setUploading(false);

      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);

    handleFiles(event.dataTransfer.files);
  };

  const reprocess = async (id) => {
    setError('');
    setRetryingId(id);

    try {
      await documentApi.reprocess(id);
      await load();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Could not retry processing. Please try again.'
      );
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-5">

      {/* PAGE HEADER */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Upload statements
        </h1>

        <p className="text-sm text-slate-500">
          Upload a bank statement or receipt. FinTrack extracts readable
          text and attempts to categorize transactions.
        </p>
      </div>

      {/* UPLOAD DROPZONE */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => {
          if (!uploading) {
            inputRef.current?.click();
          }
        }}
        onKeyDown={(event) => {
          if (
            (event.key === 'Enter' || event.key === ' ') &&
            !uploading
          ) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Choose a bank statement or receipt to upload"
        className={`rounded-2xl border-2 border-dashed p-10 text-center transition ${
          uploading ? 'cursor-wait opacity-70' : 'cursor-pointer'
        } ${
          dragging
            ? 'border-brand bg-brand/5'
            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-brand'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          disabled={uploading}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => handleFiles(event.target.files)}
        />

        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-xl text-brand">
          ↑
        </div>

        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {uploading
            ? 'Uploading…'
            : 'Drag & drop or click to browse'}
        </p>

        <p className="mt-1 text-xs text-slate-400">
          PDF, PNG, JPG or WEBP · maximum 10 MB
        </p>
      </div>

      {/* UPLOAD ERRORS */}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {loadError && (
        <p
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
        >
          {loadError}
        </p>
      )}

      {/* UPLOAD HISTORY */}
      <section className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">

        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Your uploads
          </h2>

          <button
            type="button"
            onClick={() => load().catch(() => {})}
            className="text-xs font-medium text-brand hover:underline"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Loading uploads…
          </p>
        ) : docs.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Nothing uploaded yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">

            {docs.map((doc) => (
              <li key={doc.id} className="py-4">

                <div className="flex items-start justify-between gap-3">

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                      {doc.fileName}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {formatDate(doc.createdAt)} ·{' '}
                      {doc.status === 'done'
                        ? `${doc.transactionsFound} transaction${
                            doc.transactionsFound === 1 ? '' : 's'
                          }`
                        : doc.fileType.toUpperCase()}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">

                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLE[doc.status] ||
                        STATUS_STYLE.pending
                      }`}
                    >
                      {isActive(doc.status) && (
                        <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-current align-middle" />
                      )}

                      {doc.status === 'needs_review'
                        ? 'needs review'
                        : doc.status}
                    </span>

                    {isRetryable(doc) && (
                      <button
                        type="button"
                        onClick={() => reprocess(doc.id)}
                        disabled={
                          retryingId === doc.id ||
                          isActive(doc.status)
                        }
                        className="rounded-md px-1 text-sm text-slate-400 hover:text-brand disabled:opacity-50"
                        title="Retry processing"
                        aria-label={`Retry processing ${doc.fileName}`}
                      >
                        {retryingId === doc.id ? '…' : '↻'}
                      </button>
                    )}

                  </div>
                </div>

                {doc.processingError && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    {doc.processingError}
                  </p>
                )}

              </li>
            ))}

          </ul>
        )}
      </section>
    </div>
  );
}