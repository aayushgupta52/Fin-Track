
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { streamChat } from '../services/chat.js';

const STORAGE_KEY = 'finbot_chat_v1';
const MAX_STORED = 100;

const SUGGESTIONS = [
  'How can I save more this month?',
  'What are my top expenses?',
  'How much tax can I save?',
  'Suggest a SIP for ₹5000/month',
];

const loadHistory = () => {
  try {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
};

export default function Chat() {
  const [messages, setMessages] = useState(loadHistory);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(messages.slice(-MAX_STORED))
      );
    } catch (error) {
      console.error('Could not save chat history:', error);
    }

    const container = scrollRef.current;

    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  const send = async (text) => {
    const content = text.trim();

    if (!content || busy) return;

    setInput('');

    const history = [...messages, { role: 'user', content }];

    setMessages([
      ...history,
      { role: 'assistant', content: '' },
    ]);

    setBusy(true);

    let streamedText = '';

    const append = (chunk) => {
      streamedText += chunk;

      setMessages((prev) => {
        const next = [...prev];

        if (next.length === 0) return prev;

        const lastIndex = next.length - 1;

        if (next[lastIndex].role !== 'assistant') {
          return prev;
        }

        next[lastIndex] = {
          ...next[lastIndex],
          content: streamedText,
        };

        return next;
      });
    };

    try {
      await streamChat(history, {
        onToken: append,
        onError: (msg) => append(`\n\n⚠️ ${msg}`),
      });
    } catch (error) {
      append(
        '\n\n⚠️ Unable to connect to FinBot. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] w-full max-w-6xl flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            FinBot
          </h1>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your AI finance assistant
          </p>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearChat}
            disabled={busy}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        aria-live="polite"
        className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6"
      >
        {messages.length === 0 ? (
          <div className="grid min-h-full place-items-center">
            <div className="max-w-xl text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-3xl">
                💸
              </div>

              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Welcome to FinBot
              </h2>

              <p className="mb-5 mt-2 text-sm text-slate-500 dark:text-slate-400">
                Ask questions about budgeting, spending and saving.
              </p>

              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => send(question)}
                    disabled={busy}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-emerald-500 hover:bg-emerald-500/5 hover:text-emerald-600 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-emerald-400"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((message, index) => {
            const isUser = message.role === 'user';
            const isLastMessage = index === messages.length - 1;

            return (
              <div
                key={`${index}-${message.role}`}
                className={`flex ${
                  isUser ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`min-w-0 max-w-[95%] overflow-hidden rounded-2xl px-4 py-3 text-sm leading-7 sm:max-w-[85%] ${
                    isUser
                      ? 'rounded-br-md bg-emerald-600 text-white'
                      : 'rounded-bl-md border border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100'
                  }`}
                >
                  {isUser ? (
                    <div className="whitespace-pre-wrap break-words">
                      {message.content}
                    </div>
                  ) : message.content ? (
                    <div className="break-words [&_a]:text-emerald-600 [&_a]:underline dark:[&_a]:text-emerald-400 [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-500 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-slate-200 [&_code]:px-1 [&_code]:py-0.5 [&_h1]:mb-3 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:font-bold [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_strong]:font-bold [&_strong]:text-slate-950 dark:[&_strong]:text-white [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ node, ...props }) => (
                            <a
                              {...props}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <span className="animate-pulse text-slate-400">
                      {busy && isLastMessage ? 'FinBot is thinking…' : ''}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
        className="mt-3 flex items-end gap-2"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask FinBot about your finances..."
          aria-label="Ask FinBot a question"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />

        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send'}
        </button>
      </form>

      <p className="mt-2 text-center text-xs text-slate-400">
        FinBot can make mistakes. Verify important financial decisions.
      </p>
    </div>
  );
}
