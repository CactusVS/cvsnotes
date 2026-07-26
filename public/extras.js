// Огонёк, пуш-уведомления, звук с вибрацией и чек-листы.
import { I, h, api, state, toast, plural, nameOf } from "./core.js";

// ============================================================
//  ЗВУК И ВИБРАЦИЯ
// ============================================================
const SOUND_KEY = "mn_sound";
let audioCtx = null;

export function soundOn() {
  return localStorage.getItem(SOUND_KEY) !== "0";
}
export function setSound(on) {
  localStorage.setItem(SOUND_KEY, on ? "1" : "0");
}

// Короткий сигнал плюс вибрация. Работает только после первого касания страницы.
export function buzz(kind = "ping") {
  if (!soundOn()) return;
  try {
    if (navigator.vibrate) {
      navigator.vibrate(kind === "win" ? [60, 40, 60, 40, 140] : [70, 50, 70]);
    }
  } catch {}
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(kind === "win" ? 523 : 660, t);
    o.frequency.setValueAtTime(kind === "win" ? 784 : 880, t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(t);
    o.stop(t + 0.35);
  } catch {}
}

// ============================================================
//  ОГОНЁК
// ============================================================
let lastStreak = null;

export function streakChip() {
  return h(
    "button",
    {
      class: "streak-chip cold",
      id: "streakChip",
      title: "Огонёк",
      "aria-label": "Огонёк",
      onclick: () => openFlame(),
    },
    h("span", { class: "streak-ic", html: I.flame }),
    h("span", { class: "streak-n" }, "0")
  );
}

export async function refreshStreak() {
  const el = document.getElementById("streakChip");
  if (!el) return;
  try {
    const s = await api("/api/streak");
    lastStreak = s;
    el.classList.toggle("cold", !s.burning);
    el.querySelector(".streak-n").textContent = String(s.streak);
    el.title = s.burning
      ? "Горит " + s.streak + " " + plural(s.streak, ["день", "дня", "дней"])
      : "Огонёк не зажжён сегодня";
  } catch {}
}

function personRow(id, done) {
  return h(
    "div",
    { class: "flame-row" + (done ? " done" : "") },
    h("span", { class: "who-dot " + id }),
    h("span", { class: "flame-name" }, nameOf(id)),
    h("span", { class: "flame-mark", html: done ? I.check : "" }, done ? "" : "ещё нет")
  );
}

export async function openFlame() {
  let s = lastStreak;
  try {
    s = await api("/api/streak");
    lastStreak = s;
  } catch {
    if (!s) return;
  }
  const me = state.me.user;
  const iDid = !!s.today[me];

  const scrim = h("div", { class: "modal-scrim", onclick: (e) => e.target === scrim && scrim.remove() });
  const body = h("div", { class: "modal glass flame-modal" });

  const render = () => {
    const lit = !!s.today[me];
    body.replaceChildren(
      h("div", { class: "flame-big" + (s.burning ? " on" : ""), html: I.flame }),
      h(
        "h3",
        {},
        s.burning
          ? "Горит " + s.streak + " " + plural(s.streak, ["день", "дня", "дней"])
          : s.streak
          ? "Серия " + s.streak + " " + plural(s.streak, ["день", "дня", "дней"])
          : "Огонёк не горит"
      ),
      h(
        "p",
        {},
        s.burning
          ? "Огонёк горит! Молодцы"
          : "Огонёк загорается, когда оба зажгли его за день."
      ),
      h("div", { class: "flame-people" }, personRow("angelina", !!s.today.angelina), personRow("kirill", !!s.today.kirill)),
      h(
        "div",
        { class: "modal-actions" },
        h("button", { class: "btn", onclick: () => scrim.remove() }, "Закрыть"),
        lit
          ? h("button", { class: "btn", disabled: true }, "Ты уже зажёг")
          : h(
              "button",
              {
                class: "btn btn-primary",
                onclick: async (e) => {
                  e.currentTarget.disabled = true;
                  try {
                    s = await api("/api/streak/light", "POST");
                    lastStreak = s;
                    buzz(s.burning ? "win" : "ping");
                    toast(s.burning ? "Огонёк горит!" : "Ждём второго", "ok");
                    render();
                    refreshStreak();
                  } catch {
                    toast("Не получилось", "err");
                  }
                },
              },
              "Поджечь"
            )
      )
    );
  };
  render();
  scrim.appendChild(body);
  document.body.appendChild(scrim);
}

// ============================================================
//  ПУШ-УВЕДОМЛЕНИЯ
// ============================================================
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
    toast("Браузер не умеет уведомления. На iPhone сначала добавь сайт на экран «Домой»", "err");
    return false;
  }
  if (!window.isSecureContext) {
    toast("Уведомления работают только по https", "err");
    return false;
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    toast(
      perm === "denied" ? "Уведомления запрещены в настройках браузера" : "Разрешение не получено",
      "err"
    );
    return false;
  }
  try {
    const info = await api("/api/push/key");
    if (!info.key) {
      const miss = (info.missing || []).join(" и ");
      toast(miss ? "На сервере не задано: " + miss : "На сервере нет ключей уведомлений", "err");
      return false;
    }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8(info.key),
      });
    }
    await api("/api/push/subscribe", "POST", { subscription: sub.toJSON() });
    buzz();
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

// Колокольчик открывает маленькое меню с двумя переключателями
export function bellButton() {
  return h("button", {
    class: "btn icon-btn",
    id: "bellBtn",
    title: "Уведомления",
    "aria-label": "Уведомления",
    html: I.bell,
    onclick: (e) => openBell(e.currentTarget),
  });
}

async function openBell(anchor) {
  const old = document.querySelector(".bell-pop");
  if (old) {
    old.remove();
    return;
  }
  let st = await pushState();
  let info = { kinds: [], prefs: {} };
  try {
    info = await api("/api/push/key");
  } catch {}

  const pop = h("div", { class: "popover bell-pop" });

  const row = (label, sub, on, onToggle, small) =>
    h(
      "button",
      {
        class: "bell-row" + (small ? " sub" : ""),
        onclick: async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          await onToggle();
          btn.disabled = false;
          build();
        },
      },
      h("span", { class: "bell-txt" }, h("b", {}, label), h("span", {}, sub)),
      h("span", { class: "bell-sw" + (on ? " on" : "") })
    );

  async function build() {
    st = await pushState();
    pop.replaceChildren();

    pop.appendChild(
      st.supported
        ? row("Уведомления", st.on ? "приходят на телефон" : "выключены", st.on, async () => {
            if (st.on) await disablePush();
            else await enablePush();
            try {
              info = await api("/api/push/key");
            } catch {}
          })
        : h("div", { class: "bell-note" }, "Браузер не умеет уведомления")
    );

    // что именно присылать - только когда уведомления включены
    if (st.on && info.kinds && info.kinds.length) {
      pop.appendChild(h("div", { class: "bell-sep" }, "Присылать"));
      for (const k of info.kinds) {
        const on = info.prefs[k.id] !== false;
        pop.appendChild(
          row(
            k.title,
            k.sub,
            on,
            async () => {
              try {
                const res = await api("/api/push/prefs", "POST", { prefs: { [k.id]: !on } });
                info.prefs = res.prefs;
              } catch {
                toast("Не получилось сохранить", "err");
              }
            },
            true
          )
        );
      }
      pop.appendChild(h("div", { class: "bell-sep" }, ""));
    }

    pop.appendChild(
      row("Звук и вибрация", soundOn() ? "включены" : "выключены", soundOn(), async () => {
        setSound(!soundOn());
        if (soundOn()) buzz();
      })
    );
    syncBell();
  }

  await build();
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.top = r.bottom + 8 + "px";
  pop.style.right = Math.max(12, window.innerWidth - r.right) + "px";
  const close = (e) => {
    if (!pop.contains(e.target) && e.target !== anchor) {
      pop.remove();
      document.removeEventListener("pointerdown", close);
    }
  };
  setTimeout(() => document.addEventListener("pointerdown", close), 0);
}

export async function syncBell() {
  const btn = document.getElementById("bellBtn");
  if (!btn) return;
  const st = await pushState();
  btn.title = st.on ? "Уведомления включены" : "Уведомления";
}

// ============================================================
//  ЧЕК-ЛИСТЫ
// ============================================================
const ITEM_RE = /^-\s\[([ xX])\]\s?(.*)$/;

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

export function toChecklist(text) {
  const lines = String(text || "").split("\n").filter((l) => l.trim());
  if (!lines.length) return "- [ ] ";
  return lines.map((l) => (ITEM_RE.test(l) ? l : `- [ ] ${l.trim()}`)).join("\n");
}

export function fromChecklist(text) {
  return String(text || "")
    .split("\n")
    .map((l) => {
      const m = l.match(ITEM_RE);
      return m ? m[2] : l;
    })
    .join("\n");
}

// Меняем разметку где угодно в строке: в превью с сервера переносы схлопнуты в пробелы
export function checklistPreview(text) {
  return String(text || "")
    .replace(/-\s\[[xX]\]\s?/g, "✓ ")
    .replace(/-\s\[\s?\]\s?/g, "○ ")
    .replace(/[✓○]\s*$/, "")
    .trim();
}
