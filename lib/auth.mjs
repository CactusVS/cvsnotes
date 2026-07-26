// Сессии на подписанных куках (HMAC-SHA256). Пароли проверяются только на сервере.
import { webcrypto } from "node:crypto";

const enc = new TextEncoder();
const dec = new TextDecoder();

// Два пользователя. Паролей в коде НЕТ - они берутся из переменных окружения,
// чтобы никогда не попадать в git.
// Локально: файл .env (он в .gitignore).
// В проде: Netlify -> Site configuration -> Environment variables.
export const USERS = {
  angelina: { name: "Ангелина", env: "PASSWORD_ANGELINA", gender: "f" },
  kirill: { name: "Кирилл", env: "PASSWORD_KIRILL", gender: "m" },
};

// Глагол в прошедшем времени под пол: verb("angelina", "зажёг", "зажгла")
export function verb(userId, male, female) {
  return USERS[userId] && USERS[userId].gender === "f" ? female : male;
}

// Пароль пользователя из окружения. null = переменная не задана (сервер не настроен).
export function passwordOf(userId) {
  const u = USERS[userId];
  if (!u) return null;
  const pw = process.env[u.env];
  return pw && pw.length > 0 ? pw : null;
}

export function publicUsers() {
  const out = {};
  for (const id of Object.keys(USERS)) out[id] = { name: USERS[id].name };
  return out;
}

function b64url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret, message) {
  const key = await webcrypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await webcrypto.subtle.sign("HMAC", key, enc.encode(message));
  return b64url(new Uint8Array(sig));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function checkPassword(userId, password) {
  const real = passwordOf(userId);
  if (!real) return false;
  const a = enc.encode(real);
  const b = enc.encode(password || "");
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}

export async function makeToken(userId, secret) {
  const payload = `${userId}|${Date.now()}`;
  const p = b64url(enc.encode(payload));
  const sig = await hmac(secret, p);
  return `${p}.${sig}`;
}

export async function verifyToken(token, secret) {
  if (!token || token.indexOf(".") === -1) return null;
  const [p, sig] = token.split(".");
  const expected = await hmac(secret, p);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const payload = dec.decode(fromB64url(p));
    const userId = payload.split("|")[0];
    if (!USERS[userId]) return null;
    return userId;
  } catch {
    return null;
  }
}

// --- куки ---
export function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const out = {};
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx > -1) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      if (k) out[k] = decodeURIComponent(v);
    }
  });
  return out;
}

const COOKIE_NAME = "mn_sid";
const YEAR = 60 * 60 * 24 * 365;

export function sessionCookie(token, isHttps) {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${YEAR}`,
  ];
  if (isHttps) attrs.push("Secure");
  return attrs.join("; ");
}

export function clearCookie(isHttps) {
  const attrs = [`${COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isHttps) attrs.push("Secure");
  return attrs.join("; ");
}

export function readSessionCookie(request) {
  return parseCookies(request)[COOKIE_NAME] || null;
}
