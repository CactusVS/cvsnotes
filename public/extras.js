// Огонёк (стрик) и пуш-уведомления.
import { I, h, api, state, toast, plural } from "./core.js";

// ---------- огонёк ----------
export async function refreshStreak() {
  const el = document.getElementById("streakChip");
  if (!el) return;
  try {
    const s = await api("/api/streak");
    if (!s.streak) {
      el.style.display = "none";
      return;
    }
    el.style.display = "";
    el.classList.toggle("cold", !s.today);
    el.title = s.today
      ? "Вы что-то делали " + s.streak + " " + plural(s.streak, ["день", "дня", "дней"]) + " подряд"
      : "Серия " + s.streak + ". Сегодня ещё ничего не было";
    el.querySelector(".streak-n").textContent = String(s.streak);
  } catch {}
}

export function streakChip() {
  return h(
    "span",
    { class: "streak-chip", id: "streakChip", style: "display:none" },
    h("span", { class: "streak-ic", html: I.flame }),
    h("span", { class: "streak-n" }, "0")
  );
}

// ---------- пуш-уведомления ----------
function urlB64ToUint8(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function pushState() {
  if (!pushSupported()) return { supported: false };
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return { supported: true, on: !!sub, permission: Notification.permission };
  } catch {
    return { supported: false };
  }
}

export async function enablePush() {
  if (!pushSupported()) {
    toast("Браузер не умеет уведомления", "err");
    return false;
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    toast(
      perm === "denied"
        ? "Уведомления запрещены в настройках браузера"
        : "Разрешение не получено",
      "err"
    );
    return false;
  }
  try {
    const { key } = await api("/api/push/key");
    if (!key) {
      toast("На сервере не настроены ключи уведомлений", "err");
      return false;
    }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8(key),
      });
    }
    await api("/api/push/subscribe", "POST", { subscription: sub.toJSON() });
    toast("Уведомления включены", "ok");
    return true;
  } catch (e) {
    if (e.status !== 401) toast("Не удалось включить уведомления", "err");
    return false;
  }
}

export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api("/api/push/unsubscribe", "POST", { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    toast("Уведомления выключены", "ok");
    return true;
  } catch {
    return false;
  }
}

// Кнопка-колокольчик для шапки
export function bellButton() {
  const btn = h("button", {
    class: "btn icon-btn",
    id: "bellBtn",
    title: "Уведомления",
    "aria-label": "Уведомления",
    html: I.bell,
    onclick: async () => {
      const st = await pushState();
      if (st.on) {
        await disablePush();
      } else {
        await enablePush();
      }
      syncBell();
    },
  });
  return btn;
}

export async function syncBell() {
  const btn = document.getElementById("bellBtn");
  if (!btn) return;
  const st = await pushState();
  if (!st.supported) {
    btn.style.display = "none";
    return;
  }
  btn.style.display = "";
  btn.classList.toggle("on", !!st.on);
  btn.title = st.on ? "Уведомления включены" : "Включить уведомления";
}

// ---------- чек-листы ----------
const ITEM_RE = /^-\s\[([ xX])\]\s?(.*)$/;

export function isChecklistLine(line) {
  return ITEM_RE.test(line);
}

export function parseChecklist(text) {
  const lines = String(text || "").split("\n");
  const items = [];
  for (const line of lines) {
    const m = line.match(ITEM_RE);
    if (m) items.push({ done: m[1].toLowerCase() === "x", text: m[2] });
    else if (line.trim()) items.push({ done: false, text: line });
  }
  if (!items.length) items.push({ done: false, text: "" });
  return items;
}

export function stringifyChecklist(items) {
  return items.map((it) => `- [${it.done ? "x" : " "}] ${it.text}`).join("\n");
}

// Текст заметки -> формат чек-листа (при включении режима)
export function toChecklist(text) {
  const lines = String(text || "").split("\n").filter((l) => l.trim());
  if (!lines.length) return "- [ ] ";
  return lines.map((l) => (ITEM_RE.test(l) ? l : `- [ ] ${l.trim()}`)).join("\n");
}

// Обратно в обычный текст
export function fromChecklist(text) {
  return String(text || "")
    .split("\n")
    .map((l) => {
      const m = l.match(ITEM_RE);
      return m ? m[2] : l;
    })
    .join("\n");
}

// Красивое превью чек-листа в карточке.
// Меняем разметку где угодно в строке: в превью с сервера переносы уже схлопнуты в пробелы.
export function checklistPreview(text) {
  return String(text || "")
    .replace(/-\s\[[xX]\]\s?/g, "✓ ")
    .replace(/-\s\[\s?\]\s?/g, "○ ")
    .replace(/[✓○]\s*$/, "") // пустой последний пункт не показываем
    .trim();
}
