import { OAuth2Client } from "google-auth-library";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function gmailRedirectUri() {
  return process.env.GMAIL_REDIRECT_URI ||
    `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/integrations/gmail/callback`;
}

export function oauthClient() {
  return new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, gmailRedirectUri());
}

// URL the owner visits to grant read-only Gmail access (offline → refresh token).
export function gmailAuthUrl(state) {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function exchangeCode(code) {
  const { tokens } = await oauthClient().getToken(code);
  return tokens; // { refresh_token, access_token, ... }
}

export async function accessTokenFromRefresh(refreshToken) {
  const c = oauthClient();
  c.setCredentials({ refresh_token: refreshToken });
  const { token } = await c.getAccessToken();
  return token;
}

export async function getUserEmail(accessToken) {
  const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return "";
  const d = await r.json();
  return d.email || "";
}

async function gapi(path, accessToken) {
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me" + path, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    // Surface Google's actual reason so 403s are diagnosable (insufficient scope vs API disabled).
    let detail = "";
    try { const j = await r.json(); detail = j?.error?.message || j?.error?.errors?.[0]?.message || ""; } catch { /* ignore */ }
    throw new Error(`Gmail API ${r.status}${detail ? `: ${detail}` : ""}`);
  }
  return r.json();
}

function flattenParts(part, acc = []) {
  if (!part) return acc;
  if (part.filename || part.body) acc.push(part);
  if (part.parts) part.parts.forEach((p) => flattenParts(p, acc));
  return acc;
}

function header(payload, name) {
  const h = (payload.headers || []).find((x) => x.name.toLowerCase() === name);
  return h ? h.value : "";
}

// List recent emails that have a PDF attachment, returning attachment refs + metadata.
export async function listPdfAttachments(accessToken, query, maxMessages = 250) {
  const q = query || "has:attachment filename:pdf newer_than:60d";
  // Page through results so a wide date range returns everything (not just the first 25).
  const ids = [];
  let pageToken = "";
  do {
    const list = await gapi(`/messages?q=${encodeURIComponent(q)}&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ""}`, accessToken);
    (list.messages || []).forEach((m) => ids.push(m));
    pageToken = list.nextPageToken || "";
  } while (pageToken && ids.length < maxMessages);
  const out = [];
  for (const m of ids.slice(0, maxMessages)) {
    const msg = await gapi(`/messages/${m.id}?format=full`, accessToken);
    const parts = flattenParts(msg.payload);
    for (const p of parts) {
      if (p.filename && /\.pdf$/i.test(p.filename) && p.body?.attachmentId) {
        out.push({
          messageId: m.id,
          attachmentId: p.body.attachmentId,
          filename: p.filename,
          from: header(msg.payload, "from"),
          subject: header(msg.payload, "subject"),
          date: header(msg.payload, "date"),
          sizeKB: p.body.size ? Math.round(p.body.size / 1024) : null,
        });
      }
    }
  }
  return out;
}

export async function getAttachment(accessToken, messageId, attachmentId) {
  const a = await gapi(`/messages/${messageId}/attachments/${attachmentId}`, accessToken);
  return Buffer.from(a.data, "base64url"); // Gmail returns base64url
}

// Fast list of matching message IDs only (one paginated list call, no per-message fetch).
// Returned OLDEST-FIRST so the caller imports invoices before the payment advices that follow them.
export async function listMessageIds(accessToken, query, maxMessages = 500) {
  const q = query || "has:attachment filename:pdf newer_than:365d";
  const ids = [];
  let pageToken = "";
  do {
    const list = await gapi(`/messages?q=${encodeURIComponent(q)}&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ""}`, accessToken);
    (list.messages || []).forEach((m) => ids.push(m.id));
    pageToken = list.nextPageToken || "";
  } while (pageToken && ids.length < maxMessages);
  return ids.slice(0, maxMessages).reverse(); // Gmail returns newest-first → flip to oldest-first
}

// Full body TEXT of a message (for notification emails with no attachment, e.g. depot Gate-In).
export async function getMessageText(accessToken, messageId) {
  const msg = await gapi(`/messages/${messageId}?format=full`, accessToken);
  const parts = flattenParts(msg.payload);
  let text = "";
  for (const p of parts) if (p.mimeType === "text/plain" && p.body?.data) text += Buffer.from(p.body.data, "base64url").toString("utf8") + "\n";
  if (!text) for (const p of parts) if (p.mimeType === "text/html" && p.body?.data) text += Buffer.from(p.body.data, "base64url").toString("utf8").replace(/<[^>]+>/g, " ") + "\n";
  if (!text && msg.payload?.body?.data) text = Buffer.from(msg.payload.body.data, "base64url").toString("utf8");
  return {
    subject: header(msg.payload, "subject"), from: header(msg.payload, "from"),
    dateMs: parseInt(msg.internalDate || "0", 10) || null, snippet: msg.snippet || "", text,
  };
}

// PDF attachment parts of a single message: [{ attachmentId, filename }], + the sender.
export async function getMessagePdfParts(accessToken, messageId) {
  const msg = await gapi(`/messages/${messageId}?format=full`, accessToken);
  const out = [];
  for (const p of flattenParts(msg.payload)) {
    if (p.filename && /\.pdf$/i.test(p.filename) && p.body?.attachmentId) {
      out.push({ attachmentId: p.body.attachmentId, filename: p.filename });
    }
  }
  return { parts: out, from: header(msg.payload, "from") };
}
