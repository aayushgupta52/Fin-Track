// WhatsApp gateway built on Baileys (@whiskeysockets/baileys).
//
// Responsibilities:
//  - Establish and maintain a WhatsApp Web connection using a persisted session
//    (multi-file auth state under ./auth_info_baileys).
//  - Print a QR code to the terminal for the first login.
//  - Automatically reconnect on transient disconnects (but not after a logout).
//  - Filter the incoming stream down to private text chats and hand them to the
//    message handler.
//
// The whole integration is gated behind the WHATSAPP_ENABLED env flag so that
// developers who don't want to scan a QR on every boot are never prompted.

import { Boom } from '@hapi/boom';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import path from 'node:path';
import { logger } from '../utils/logger.js';
import { handleIncomingMessage } from './whatsapp.handlers.js';

const AUTH_DIR = path.resolve(process.cwd(), 'auth_info_baileys');
const isEnabled = () => process.env.WHATSAPP_ENABLED === 'true';

// Baileys is chatty on its own logger; keep it silent and route meaningful
// events through the app's Winston logger instead.
const waLogger = pino({ level: 'silent' });

// Module-level connection state, exposed read-only via getWhatsAppStatus().
let sock = null;
let status = 'disconnected'; // 'disconnected' | 'connecting' | 'qr' | 'connected'
let lastQr = null;

/**
 * Opens (or re-opens) the WhatsApp socket and wires up all event listeners.
 * Safe to call repeatedly — used both for the initial connect and reconnects.
 */
const startSock = async () => {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  status = 'connecting';
  sock = makeWASocket({
    version,
    auth: state,
    logger: waLogger,
    printQRInTerminal: false, // we render the QR ourselves for nicer output
    markOnlineOnConnect: false,
  });

  // Persist credentials whenever they rotate so the session survives restarts.
  sock.ev.on('creds.update', saveCreds);

  // Connection lifecycle: QR display, open, and reconnect logic.
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      lastQr = qr;
      status = 'qr';
      logger.info('[whatsapp] scan the QR below with WhatsApp > Linked Devices');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      status = 'connected';
      lastQr = null;
      logger.info('[whatsapp] connection open — ready to receive messages');
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      status = 'disconnected';

      if (loggedOut) {
        logger.warn(
          `[whatsapp] logged out — delete the ${AUTH_DIR} folder and restart to re-link`
        );
        return; // do not reconnect; the session is invalid
      }

      logger.warn(`[whatsapp] connection closed (code ${statusCode}) — reconnecting…`);
      startSock().catch((err) => logger.error(`[whatsapp] reconnect failed: ${err.message}`));
    }
  });

  // Incoming messages: filter, then delegate to the handler.
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return; // ignore history/append syncs

    for (const msg of messages) {
      try {
        await routeMessage(msg);
      } catch (err) {
        logger.error(`[whatsapp] message handling error: ${err.message}`);
      }
    }
  });

  return sock;
};

/**
 * Applies the private-text-only filtering rules and forwards qualifying
 * messages to the domain handler with a bound reply() helper.
 */
const routeMessage = async (msg) => {
  if (!msg.message) return; // e.g. receipts, reactions with no body
  if (msg.key.fromMe) return; // ignore our own outbound echoes

  const from = msg.key.remoteJid || '';

  // (6) ignore groups, (7) ignore status broadcasts, (8) private chats only.
  if (from.endsWith('@g.us')) return;
  if (from === 'status@broadcast') return;
  if (!from.endsWith('@s.whatsapp.net')) return;

  // (5/9) plain-text bodies only; other message types are not actionable here.
  const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
  if (!text.trim()) return;

  logger.info(`[whatsapp] message from ${from}: ${text.slice(0, 80)}`);

  const reply = (body) => sendText(from, body);
  await handleIncomingMessage({ from, text, reply });
};

/**
 * Sends a plain-text message to a JID. Throws if the socket isn't ready.
 */
export const sendText = async (jid, body) => {
  if (!sock) throw new Error('WhatsApp socket is not connected');
  await sock.sendMessage(jid, { text: body });
};

/**
 * Boots the WhatsApp integration. No-op (with a log line) when disabled so the
 * rest of the server always starts cleanly.
 */
export const initWhatsApp = async () => {
  if (!isEnabled()) {
    logger.info('[whatsapp] disabled (set WHATSAPP_ENABLED=true to enable)');
    return;
  }
  try {
    logger.info('[whatsapp] starting…');
    await startSock();
  } catch (err) {
    logger.error(`[whatsapp] failed to start: ${err.message}`);
  }
};

/** Read-only snapshot of the connection, surfaced by the status route. */
export const getWhatsAppStatus = () => ({
  enabled: isEnabled(),
  status,
  connected: status === 'connected',
  // The raw QR string; a frontend could render it if desired.
  qr: status === 'qr' ? lastQr : null,
});
