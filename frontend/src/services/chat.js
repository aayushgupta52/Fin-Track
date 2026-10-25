import { useAuthStore } from '../store/auth.js';
import { refreshAccessToken, API_BASE_URL } from './api.js';

// SSE can't carry an Authorization header via EventSource, so we stream the
// chat over fetch + ReadableStream instead and parse `data:` frames manually.
const openStream = (messages, token, signal) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_BASE_URL}/ai/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages }),
    credentials: 'include',
    signal,
  });
};

// Streams an assistant reply. Calls onToken(text) per chunk; resolves on [DONE].
export async function streamChat(messages, { onToken, onError, signal } = {}) {
  let token = useAuthStore.getState().accessToken;
  let res = await openStream(messages, token, signal);

  // One-time refresh + retry on an expired access token.
  if (res.status === 401) {
    try {
      token = await refreshAccessToken();
      res = await openStream(messages, token, signal);
    } catch {
      onError?.('Your session expired. Please log in again.');
      return;
    }
  }

  if (!res.ok || !res.body) {
    onError?.(`Chat failed (${res.status}).`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line.
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const obj = JSON.parse(payload);
        if (obj.text) onToken?.(obj.text);
        if (obj.error) onError?.(obj.error);
      } catch {
        // Ignore keep-alive / partial frames.
      }
    }
  }
}
