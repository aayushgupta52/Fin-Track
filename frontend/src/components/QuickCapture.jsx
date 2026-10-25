import { useRef, useState } from 'react';
import { aiApi, expenseApi } from '../services/api.js';
import { CATEGORY_NAMES, PAYMENT_METHODS } from '../constants/categories.js';
import Field, { inputClass } from './Field.jsx';

// Web Speech API — browser-native, no key needed. Chrome/Edge support it.
const SpeechRecognition =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
const voiceSupported = !!SpeechRecognition;

const clampCategory = (c) => (CATEGORY_NAMES.includes(c) ? c : 'Other');
const clampPayment = (p) => (PAYMENT_METHODS.includes(p) ? p : 'UPI');

// Voice + UPI-SMS quick capture. Speaks/pastes a raw line, sends it to the AI
// categorizer, then shows an editable draft before saving as an expense.
export default function QuickCapture({ onAdded }) {
  const [mode, setMode] = useState('voice'); // 'voice' | 'sms'
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const recRef = useRef(null);

  const reset = () => {
    setDraft(null);
    setText('');
    setError('');
  };

  const parse = async (raw) => {
    const input = (raw ?? text).trim();
    if (!input) return;
    setParsing(true);
    setError('');
    try {
      const { categorization: c } = await aiApi.categorize(input);
      setDraft({
        amount: c.amount || '',
        category: clampCategory(c.category),
        merchant: c.merchant || '',
        paymentMethod: clampPayment(c.paymentMethod),
        description: input,
        confidence: typeof c.confidence === 'number' ? c.confidence : null,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not read that. Try again or add manually.');
    } finally {
      setParsing(false);
    }
  };

  const startVoice = () => {
    if (!voiceSupported) return;
    setError('');
    setDraft(null);
    const rec = new SpeechRecognition();
    rec.lang = 'en-IN'; // Indian English; also copes with Hinglish numbers
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setText(transcript);
      parse(transcript);
    };
    rec.onerror = (e) => {
      setListening(false);
      // Mobile browsers report permission/https issues with these codes.
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Mic blocked. Allow microphone access for this site in your browser settings, then retry.');
      } else if (e.error === 'no-speech') {
        setError('Didn’t catch that — try again.');
      } else if (e.error === 'aborted') {
        setError('');
      } else if (e.error === 'network') {
        setError('Voice needs an internet connection. Check your network and retry.');
      } else {
        setError(`Mic error: ${e.error}`);
      }
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    // rec.start() can throw synchronously on mobile (InvalidStateError if a prior
    // session didn't fully stop). Guard it so the button never dead-ends.
    try {
      rec.start();
    } catch {
      setListening(false);
      setError('Could not start the mic. Close other apps using it and try again.');
    }
  };

  const stopVoice = () => recRef.current?.stop();

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await expenseApi.create({
        amount: Number(draft.amount),
        category: draft.category,
        merchant: draft.merchant || undefined,
        description: draft.description || undefined,
        paymentMethod: draft.paymentMethod,
        date: new Date().toISOString(),
      });
      reset();
      onAdded?.();
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.message || 'Could not add expense');
    } finally {
      setBusy(false);
    }
  };

  const setField = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });

  return (
    <div>
      {/* Mode toggle */}
      <div className="mb-4 inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 text-sm">
        {[
          { k: 'voice', label: '🎤 Speak' },
          { k: 'sms', label: '📩 Paste SMS' },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => {
              setMode(t.k);
              reset();
            }}
            className={`rounded-md px-3 py-1 font-medium transition ${
              mode === t.k
                ? 'bg-brand text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Voice mode */}
      {mode === 'voice' &&
        (voiceSupported ? (
          <div className="flex items-center gap-3">
            <button
              onClick={listening ? stopVoice : startVoice}
              disabled={parsing}
              className={`grid h-14 w-14 place-items-center rounded-full text-2xl text-white transition disabled:opacity-60 ${
                listening ? 'animate-pulse bg-red-500' : 'bg-brand hover:bg-brand-dark'
              }`}
              title={listening ? 'Stop' : 'Start speaking'}
            >
              🎤
            </button>
            <div className="text-sm text-slate-500">
              {listening
                ? 'Listening… say “Add ₹500 food at Zomato”'
                : parsing
                  ? 'Reading…'
                  : text || 'Tap the mic and say your expense'}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Voice isn’t available in this browser. On mobile, open the site in Chrome
            (not an in-app browser), or use “📩 Paste SMS” / the form below to add expenses.
          </p>
        ))}

      {/* SMS mode */}
      {mode === 'sms' && (
        <div className="space-y-2">
          <textarea
            rows={3}
            className={inputClass}
            placeholder="Paste a UPI/bank SMS, e.g. “Rs 450 debited via UPI to ZOMATO on 03-Jul. Ref 4432…”"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            onClick={() => parse()}
            disabled={parsing || !text.trim()}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {parsing ? 'Reading…' : 'Read SMS'}
          </button>
        </div>
      )}

      {/* Parsed draft — review then save */}
      {draft && (
        <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Review &amp; save</p>
            {draft.confidence != null && (
              <span className="text-xs text-slate-400">
                AI confidence {Math.round(draft.confidence * 100)}%
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Amount (₹)">
              <input
                type="number"
                min="1"
                step="0.01"
                className={inputClass}
                value={draft.amount}
                onChange={setField('amount')}
              />
            </Field>
            <Field label="Category">
              <select className={inputClass} value={draft.category} onChange={setField('category')}>
                {CATEGORY_NAMES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Merchant">
              <input className={inputClass} value={draft.merchant} onChange={setField('merchant')} />
            </Field>
            <Field label="Payment">
              <select
                className={inputClass}
                value={draft.paymentMethod}
                onChange={setField('paymentMethod')}
              >
                {PAYMENT_METHODS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={save}
              disabled={busy || !draft.amount}
              className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {busy ? 'Adding…' : 'Add expense'}
            </button>
            <button
              onClick={reset}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
