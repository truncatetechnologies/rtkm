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
  if (!r.ok) throw new Error(`Gmail API ${r.status}`);
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
