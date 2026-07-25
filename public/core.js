// Общее для заметок и игр: иконки, состояние, DOM-хелпер, запросы, тосты.

// ---------- иконки (инлайн SVG, currentColor) ----------
export const I = {
  leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.7 6.2A9.8 9.8 0 0 1 12 6c6.5 0 10 6 10 6a13 13 0 0 1-2.3 2.9M6.6 6.6A13 13 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4.2-.9"/><path d="m3 3 18 18"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6l-1 6 3 3H7l3-3-1-6Z"/><path d="M12 16v4"/></svg>',
  pinFill: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M9 3h6a1 1 0 0 1 .96 1.28L15 9l2.7 2.7A1 1 0 0 1 17 13.4h-4v6.6a1 1 0 0 1-2 0v-6.6H7a1 1 0 0 1-.7-1.7L9 9 8.04 4.28A1 1 0 0 1 9 3Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7"/></svg>',
  palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1 .9-1.5 2-1.5h1.5A4.5 4.5 0 0 0 22 10.5C22 5.8 17.5 2 12 2Z"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3"/><path d="M10 12H3m0 0 3-3m-3 3 3 3"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></svg>',

  // игры
  gamepad:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 12h4M9 10v4M15.5 11.5h.01M18 13.5h.01"/><path d="M17.5 6h-11A4.5 4.5 0 0 0 2 10.5v3A4.5 4.5 0 0 0 6.5 18c1.5 0 2.2-.6 3-1.4l.6-.6h3.8l.6.6c.8.8 1.5 1.4 3 1.4a4.5 4.5 0 0 0 4.5-4.5v-3A4.5 4.5 0 0 0 17.5 6Z"/></svg>',
  stats:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  anchor:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2.5"/><path d="M12 7.5V21M5 13a7 7 0 0 0 14 0M3 13h4M17 13h4"/></svg>',
  disc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  letters:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M7 15l2.4-6 2.4 6M7.7 13.3h3.4M15.5 9v6M15.5 15c2 0 2.6-1 2.6-3s-.6-3-2.6-3"/></svg>',
  target:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/></svg>',
  bomb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="14.5" r="6.5"/><path d="M16 9l2-2M17.5 4.5 19 6M21 8.5 19.5 9M19 3v2.5"/></svg>',
  burst:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 2.4 5.2L20 8l-4 3.8 1 5.7-5-2.8-5 2.8 1-5.7L4 8l5.6-.8Z"/></svg>',
  shuffle:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3.5 21 7l-4 3.5M17 13.5 21 17l-4 3.5"/><path d="M21 7H16c-3 0-4 2-5.5 5S8 17 5 17H3M3 7h2c1.6 0 2.7.6 3.7 1.7M21 17h-5c-1.6 0-2.7-.6-3.7-1.7"/></svg>',
  trophy:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4.5a2.5 2.5 0 0 0 2.5 4M17 6h2.5a2.5 2.5 0 0 1-2.5 4M9.5 14h5l.7 3.5H8.8L9.5 14ZM7 20h10"/></svg>',
  close:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  users:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 19.5c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5"/><path d="M16.5 5.2a3.2 3.2 0 0 1 0 5.9M18 14.3c2 .7 3.5 2.3 3.5 4.6"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5.5v13l11-6.5Z"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5v-15Z"/><path d="M4 19.5A1.5 1.5 0 0 1 5.5 21H19"/></svg>',
};

export const NAMES = { angelina: "Ангелина", kirill: "Кирилл" };

// родительный падеж: "ход Ангелины", "от Кирилла"
const NAMES_GEN = { angelina: "Ангелины", kirill: "Кирилла" };

// прошедшее время под род: "Победила" / "Победил"
export const WON = { angelina: "Победила", kirill: "Победил" };

export const VERB = {
  create: { angelina: "создала", kirill: "создал" },
  edit: { angelina: "изменила", kirill: "изменил" },
  rename: { angelina: "переименовала", kirill: "переименовал" },
};

export const state = {
  me: null,
  notes: [],
  filter: "",
  reveal: false,
  editorEl: null,
  editor: null,
  listPoll: null,
  notePoll: null,
  games: null,
  fine: window.matchMedia("(pointer: fine)").matches,
};

// ---------- DOM ----------
export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k === "style") e.setAttribute("style", v);
    else if (k.slice(0, 2) === "on" && typeof v === "function")
      e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    e.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
  }
  return e;
}

export const icon = (name, cls) =>
  h("span", { class: cls || "ic-wrap", html: I[name], "aria-hidden": "true" });

// ---------- запросы ----------
// Обработчик разлогина регистрирует app.js, чтобы не было кольцевого импорта
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export async function api(path, method = "GET", body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  let data = {};
  try {
    data = await res.json();
  } catch {}
  if (res.status === 401 && path !== "/api/login") {
    state.me = null;
    onUnauthorized();
    throw Object.assign(new Error("Не авторизован"), { status: 401 });
  }
  if (!res.ok)
    throw Object.assign(new Error(data.error || "Ошибка"), { status: res.status, data });
  return data;
}

// ---------- форматирование ----------
export function nameOf(id) {
  return (
    (state.me && state.me.users && state.me.users[id] && state.me.users[id].name) ||
    NAMES[id] ||
    id
  );
}

// имя в родительном падеже, с запасным вариантом
export function nameGen(id) {
  return NAMES_GEN[id] || nameOf(id);
}

export function plural(n, forms) {
  const a = Math.abs(n) % 100,
    b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export function ago(ts) {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 45) return "только что";
  const m = Math.floor(s / 60);
  if (m < 60) return m + " " + plural(m, ["минуту", "минуты", "минут"]) + " назад";
  const now = new Date();
  const d = new Date(ts);
  const sameDay = now.toDateString() === d.toDateString();
  const h2 = Math.floor(m / 60);
  if (sameDay) return h2 + " " + plural(h2, ["час", "часа", "часов"]) + " назад";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (y.toDateString() === d.toDateString())
    return "вчера, " + d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
  const opts = { day: "numeric", month: "short" };
  if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("ru", opts);
}

export function fullTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const opts = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
  if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return d.toLocaleString("ru", opts);
}

// ---------- тосты (реальный статус на каждый) ----------
const toastWrap = document.getElementById("toasts");

export function toast(msg, kind = "info", action) {
  const t = h(
    "div",
    { class: "toast " + kind, role: "status" },
    icon(kind === "ok" ? "check" : kind === "err" ? "alert" : "info", "ic"),
    h("div", { class: "toast-body" }, msg),
    action &&
      h(
        "button",
        {
          class: "toast-act",
          onclick: () => {
            action.fn();
            dismiss();
          },
        },
        action.label
      )
  );
  function dismiss() {
    t.classList.add("out");
    setTimeout(() => t.remove(), 320);
  }
  toastWrap.appendChild(t);
  if (!action) setTimeout(dismiss, 3200);
  else setTimeout(dismiss, 7000);
  return dismiss;
}
