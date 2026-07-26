// Заметки - клиент
import {
  I,
  VERB,
  state,
  h,
  icon,
  api,
  setUnauthorizedHandler,
  nameOf,
  plural,
  ago,
  fullTime,
  toast,
  replaceKeepPageScroll,
} from "./core.js";
import { openGames, startGamesBadge } from "./games.js";
import {
  streakChip,
  refreshStreak,
  bellButton,
  syncBell,
  parseChecklist,
  stringifyChecklist,
  toChecklist,
  fromChecklist,
  checklistPreview,
} from "./extras.js";

const app = document.getElementById("app");

// core.js не знает про экраны, поэтому разлогин обрабатываем здесь
setUnauthorizedHandler(() => renderLogin());

// ============================================================
//  ЛОГИН
// ============================================================
function renderLogin() {
  stopPolling();
  document.body.classList.remove("reveal");
  const pw = h("input", {
    class: "field",
    type: "password",
    placeholder: "Пароль",
    autocomplete: "current-password",
    inputmode: "text",
  });
  const errBox = h("div", { class: "login-error" });
  let selected = null;

  const submitBtn = h("button", { class: "btn btn-primary", type: "submit" }, "Войти");
  const pwToggle = h("button", {
    type: "button",
    class: "pw-toggle",
    "aria-label": "Показать пароль",
    html: I.eye,
    onclick: (e) => {
      const b = e.currentTarget;
      if (pw.type === "password") {
        pw.type = "text";
        b.innerHTML = I.eyeOff;
      } else {
        pw.type = "password";
        b.innerHTML = I.eye;
      }
      pw.focus();
    },
  });
  const form = h(
    "form",
    {
      class: "login-form",
      onsubmit: async (e) => {
        e.preventDefault();
        if (!selected) return;
        errBox.textContent = "";
        submitBtn.disabled = true;
        submitBtn.textContent = "Входим…";
        try {
          await api("/api/login", "POST", { user: selected, password: pw.value });
          const full = await api("/api/me");
          state.me = full;
          enterApp();
        } catch (err) {
          errBox.textContent = err.data && err.data.error ? err.data.error : "Не удалось войти";
          submitBtn.disabled = false;
          submitBtn.textContent = "Войти";
          pw.focus();
          pw.select();
        }
      },
    },
    h(
      "div",
      { class: "login-form-inner" },
      h("div", { class: "pw-wrap" }, pw, pwToggle),
      errBox,
      submitBtn
    )
  );

  function makeWho(u) {
    return h(
      "button",
      {
        type: "button",
        class: "who-card",
        onclick: (e) => {
          selected = u.id;
          [...whoRow.children].forEach((c) => c.classList.remove("sel"));
          e.currentTarget.classList.add("sel");
          form.classList.add("show");
          errBox.textContent = "";
          setTimeout(() => pw.focus(), 350);
        },
      },
      h("div", { class: "who-avatar" }, u.name[0]),
      h("div", { class: "who-name" }, u.name)
    );
  }
  const whoRow = h(
    "div",
    { class: "who" },
    makeWho({ id: "angelina", name: "Ангелина" }),
    makeWho({ id: "kirill", name: "Кирилл" })
  );

  const card = h(
    "section",
    { class: "login-card glass load-in" },
    h("div", { class: "brand-mark", html: I.leaf }),
    h("h1", { class: "brand" }, "Заметки"),
    h("p", { class: "login-sub" }, "Заметки для двоих"),
    whoRow,
    form
  );
  app.replaceChildren(h("div", { class: "login" }, card));
}

// ============================================================
//  ПРИЛОЖЕНИЕ / СПИСОК
// ============================================================
function enterApp() {
  document.body.classList.toggle("reveal", state.reveal);
  const eyeBtn = h("button", {
    class: "btn icon-btn" + (state.reveal ? " on" : ""),
    title: "Показать, кто что писал",
    "aria-label": "Режим авторства",
    html: state.reveal ? I.eyeOff : I.eye,
    onclick: (e) => toggleReveal(e.currentTarget),
  });

  const search = h("input", {
    type: "search",
    placeholder: "Поиск по заметкам…",
    value: state.filter,
    oninput: (e) => {
      state.filter = e.target.value;
      renderGrid();
    },
  });

  const grid = h("div", { class: "grid", id: "grid" });
  const listArea = h("div", { id: "listArea" });

  const top = h(
    "header",
    { class: "topbar" },
    h(
      "div",
      { class: "topbar-brand" },
      h("span", { class: "dot", html: I.leaf }),
      h(
        "span",
        { class: "brand-text" },
        "Заметки",
        h("span", { class: "who-mini" }, "  ·  " + nameOf(state.me.user))
      ),
      h("span", { class: "who-dot mini-dot " + state.me.user, title: nameOf(state.me.user) })
    ),
    streakChip(),
    bellButton(),
    h("button", {
      class: "btn icon-btn",
      id: "gamesBtn",
      title: "Игры",
      "aria-label": "Игры",
      html: I.gamepad,
      onclick: () => openGames(),
    }),
    eyeBtn,
    h("button", {
      class: "btn icon-btn",
      title: "Выйти",
      "aria-label": "Выйти",
      html: I.logout,
      onclick: logout,
    })
  );

  const wrap = h(
    "div",
    { class: "wrap" },
    h("div", { class: "searchbar glass" }, icon("search"), search),
    listArea
  );

  const fab = h("button", {
    class: "fab",
    title: "Новая заметка",
    "aria-label": "Новая заметка",
    html: I.plus,
    onclick: createNote,
  });
  app.replaceChildren(top, wrap, fab);
  app.querySelector("#listArea").appendChild(loadingGrid());
  loadNotes();
  startListPoll();
}

function loadingGrid() {
  const g = h("div", { class: "grid" });
  for (let i = 0; i < 6; i++) {
    const s = h("div", { class: "skeleton" });
    s.style.height = 110 + ((i * 37) % 90) + "px";
    g.appendChild(s);
  }
  return g;
}

async function loadNotes() {
  try {
    const { notes } = await api("/api/notes");
    state.notes = notes;
    renderGrid();
  } catch (err) {
    if (err.status !== 401) {
      const area = document.getElementById("listArea");
      if (area) area.replaceChildren(errorState());
    }
  }
}

function errorState() {
  return h(
    "div",
    { class: "empty" },
    h("div", { class: "empty-mark", html: I.alert }),
    h("h3", {}, "Не удалось загрузить"),
    h("p", {}, "Проверь соединение и попробуй ещё раз."),
    h("button", { class: "btn", style: "margin-top:1.2rem", onclick: loadNotes }, "Повторить")
  );
}

function filteredNotes() {
  const q = state.filter.trim().toLowerCase();
  if (!q) return state.notes;
  return state.notes.filter(
    (n) =>
      (n.title || "").toLowerCase().includes(q) ||
      (n.preview || "").toLowerCase().includes(q)
  );
}

function renderGrid() {
  const area = document.getElementById("listArea");
  if (!area) return;
  const notes = filteredNotes();

  if (!notes.length) {
    if (state.filter.trim()) {
      area.replaceChildren(
        h(
          "div",
          { class: "empty" },
          h("div", { class: "empty-mark", html: I.search }),
          h("h3", {}, "Ничего не найдено"),
          h("p", {}, "Попробуй другой запрос.")
        )
      );
    } else {
      area.replaceChildren(
        h(
          "div",
          { class: "empty load-in" },
          h("div", { class: "empty-mark", html: I.spark }),
          h("h3", {}, "Здесь пока пусто"),
          h("p", {}, "Нажми на  +  внизу, чтобы написать первую заметку друг другу.")
        )
      );
    }
    return;
  }

  const pinned = notes.filter((n) => n.pinned);
  const rest = notes.filter((n) => !n.pinned);
  const frag = document.createDocumentFragment();
  if (pinned.length) {
    frag.appendChild(h("div", { class: "section-label" }, "Закреплённые"));
    frag.appendChild(gridOf(pinned));
    if (rest.length) frag.appendChild(h("div", { class: "section-label" }, "Остальные"));
  }
  if (rest.length) frag.appendChild(gridOf(rest));
  replaceKeepPageScroll(area, frag);
}

function gridOf(notes) {
  const g = h("div", { class: "grid" });
  notes.forEach((n, i) => {
    const c = card(n);
    c.style.animationDelay = Math.min(i * 40, 400) + "ms";
    g.appendChild(c);
  });
  return g;
}

function card(n) {
  const colorCls = n.color && n.color !== "default" ? " c-" + n.color : "";
  const foot = h(
    "div",
    { class: "card-foot" },
    h("span", { class: "who-dot " + n.updated_by + " attr-only" }),
    h("span", { class: "attr-only" }, nameOf(n.updated_by) + " · "),
    ago(n.updated_at)
  );
  const bodyEl = n.empty
    ? h("div", { class: "card-body card-empty" }, "Пустая заметка")
    : h("div", { class: "card-body" }, n.checklist ? checklistPreview(n.preview) : n.preview);

  const c = h(
    "article",
    {
      class: "card load-in" + colorCls,
      tabindex: "0",
      role: "button",
      onclick: () => openNote(n.id),
      onkeydown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openNote(n.id);
        }
      },
    },
    n.pinned && h("span", { class: "card-pin", html: I.pinFill }),
    n.title && n.title.trim()
      ? h("h3", { class: "card-title" }, n.title)
      : null,
    bodyEl,
    foot
  );
  return c;
}

async function createNote() {
  try {
    const { note } = await api("/api/notes", "POST");
    state.notes.unshift({
      id: note.id,
      title: "",
      preview: "",
      empty: true,
      color: "default",
      pinned: false,
      created_by: note.created_by,
      created_at: note.created_at,
      updated_by: note.updated_by,
      updated_at: note.updated_at,
    });
    openEditor(note, true);
  } catch (err) {
    if (err.status !== 401) toast("Не удалось создать заметку", "err");
  }
}

async function openNote(id) {
  try {
    const { note } = await api("/api/notes/" + id + "?history=1");
    openEditor(note, false);
  } catch (err) {
    if (err.status === 404) {
      toast("Заметка удалена", "info");
      state.notes = state.notes.filter((n) => n.id !== id);
      renderGrid();
    } else if (err.status !== 401) toast("Не удалось открыть", "err");
  }
}

async function logout() {
  try {
    await api("/api/logout", "POST");
  } catch {}
  state.me = null;
  state.notes = [];
  stopPolling();
  renderLogin();
}

// ---------- атрибуция ----------
function toggleReveal(btn) {
  state.reveal = !state.reveal;
  document.body.classList.toggle("reveal", state.reveal);
  document.querySelectorAll("[data-eye]").forEach((b) => {
    b.classList.toggle("on", state.reveal);
    b.innerHTML = state.reveal ? I.eyeOff : I.eye;
  });
  if (btn) {
    btn.classList.toggle("on", state.reveal);
    btn.innerHTML = state.reveal ? I.eyeOff : I.eye;
  }
  if (state.editor) renderEditorBody();
}

// ============================================================
//  РЕДАКТОР
// ============================================================
function openEditor(note, isNew) {
  history.pushState({ mn: "editor", id: note.id }, "");
  buildEditor(note, isNew);
}

function buildEditor(note, isNew) {
  state.editor = {
    note,
    dirty: false,
    saving: false,
    saveTimer: null,
    everTyped: false,
    conflictShown: false,
  };

  const titleInput = h("input", {
    class: "title-input",
    placeholder: "Заголовок",
    value: note.title || "",
    "aria-label": "Заголовок",
    oninput: onEdit,
  });

  const bodyWrap = h("div", { id: "editorBodyWrap" });

  const saveState = h("div", { class: "save-state", id: "saveState" }, "");

  const eyeBtn = h("button", {
    class: "btn icon-btn" + (state.reveal ? " on" : ""),
    "data-eye": "1",
    title: "Кто что писал",
    "aria-label": "Режим авторства",
    html: state.reveal ? I.eyeOff : I.eye,
    onclick: (e) => toggleReveal(),
  });

  const pinBtn = h("button", {
    class: "btn icon-btn" + (note.pinned ? " on" : ""),
    title: "Закрепить",
    "aria-label": "Закрепить",
    html: note.pinned ? I.pinFill : I.pin,
    onclick: (e) => togglePin(e.currentTarget),
  });

  const palBtn = h("button", {
    class: "btn icon-btn",
    title: "Цвет",
    "aria-label": "Цвет заметки",
    html: I.palette,
    onclick: (e) => openPalette(e.currentTarget),
  });

  const clBtn = h("button", {
    class: "btn icon-btn" + (note.checklist ? " on" : ""),
    title: "Чек-лист",
    "aria-label": "Чек-лист",
    html: I.check2,
    onclick: (e) => toggleChecklist(e.currentTarget),
  });

  const top = h(
    "div",
    { class: "editor-top" },
    h("button", {
      class: "btn icon-btn btn-ghost",
      title: "Назад",
      "aria-label": "Назад",
      html: I.back,
      onclick: () => closeEditor(),
    }),
    saveState,
    h("div", { class: "spacer" }),
    eyeBtn,
    clBtn,
    pinBtn,
    palBtn,
    h("button", {
      class: "btn icon-btn btn-ghost btn-danger",
      title: "Удалить",
      "aria-label": "Удалить",
      html: I.trash,
      onclick: confirmDelete,
    })
  );

  const scroll = h(
    "div",
    { class: "editor-scroll" },
    titleInput,
    metaLine(note),
    bodyWrap
  );

  const panel = h("div", { class: "editor-panel" }, top, scroll);
  const el = h(
    "div",
    { class: "editor" },
    h("div", { class: "editor-scrim", onclick: () => closeEditor() }),
    panel
  );

  state.editorEl = el;
  state.editor.titleInput = titleInput;
  state.editor.bodyWrap = bodyWrap;
  state.editor.saveState = saveState;
  document.body.appendChild(el);
  renderEditorBody();
  startNotePoll();

  if (isNew) setTimeout(() => titleInput.focus(), 320);
}

function metaLine(note) {
  return h(
    "div",
    { class: "meta-line" },
    icon("clock", "ic-wrap"),
    "изменено " + ago(note.updated_at),
    h("span", { class: "attr-only" }, " · " + nameOf(note.updated_by))
  );
}

// Подмена тела заметки не должна дёргать прокрутку - опрос идёт каждые 5 секунд
function setBody(ed, ...kids) {
  const scroll = ed.bodyWrap.closest(".editor-scroll");
  const y = scroll ? scroll.scrollTop : 0;
  ed.bodyWrap.replaceChildren(...kids);
  if (scroll && y) scroll.scrollTop = y;
}

function renderEditorBody() {
  const ed = state.editor;
  if (!ed) return;
  const note = ed.note;

  if (state.reveal) {
    // читаемый режим с подсветкой авторства + таймлайн
    const legend = h(
      "div",
      { class: "legend" },
      legendChip("angelina"),
      legendChip("kirill")
    );
    const banner = h(
      "div",
      { class: "reveal-banner" },
      icon("info", "ic"),
      "Режим авторства: подсвечено, кто какой кусок написал. Выключи глаз, чтобы редактировать."
    );
    const blame = h("div", { class: "blame-view" });
    renderBlame(blame, note.tokens || []);
    setBody(ed, banner, legend, blame, timeline(note.history || []));
  } else if (note.checklist) {
    ed.body = null;
    renderChecklist();
  } else {
    ed.getContent = null;
    const body = h("textarea", {
      class: "body-input",
      placeholder: "Пиши здесь…",
      "aria-label": "Текст заметки",
      oninput: onEdit,
    });
    body.value = note.content || "";
    ed.body = body;
    setBody(ed, body);
    autoGrow(body);
  }
}

// Чек-лист: галочки вместо сплошного текста
function renderChecklist(focusIndex) {
  const ed = state.editor;
  if (!ed) return;
  if (!ed.clItems) ed.clItems = parseChecklist(ed.note.content || "");
  const items = ed.clItems;
  ed.getContent = () => stringifyChecklist(items);

  const list = h("div", { class: "cl" });
  items.forEach((it, i) => {
    const input = h("input", {
      class: "cl-text" + (it.done ? " done" : ""),
      value: it.text,
      placeholder: "Пункт",
      oninput: (e) => {
        it.text = e.target.value;
        onEdit();
      },
      onkeydown: (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          items.splice(i + 1, 0, { done: false, text: "" });
          onEdit();
          renderChecklist(i + 1);
        } else if (e.key === "Backspace" && !it.text && items.length > 1) {
          e.preventDefault();
          items.splice(i, 1);
          onEdit();
          renderChecklist(Math.max(0, i - 1));
        }
      },
    });
    list.appendChild(
      h(
        "div",
        { class: "cl-row" },
        h("button", {
          class: "cl-box" + (it.done ? " on" : ""),
          "aria-label": it.done ? "Снять галочку" : "Отметить",
          html: it.done ? I.check : "",
          onclick: () => {
            it.done = !it.done;
            onEdit();
            renderChecklist();
          },
        }),
        input,
        h("button", {
          class: "cl-del",
          "aria-label": "Убрать пункт",
          html: I.close,
          onclick: () => {
            items.splice(i, 1);
            if (!items.length) items.push({ done: false, text: "" });
            onEdit();
            renderChecklist();
          },
        })
      )
    );
  });

  const done = items.filter((x) => x.done).length;
  list.appendChild(
    h(
      "button",
      {
        class: "cl-add",
        onclick: () => {
          items.push({ done: false, text: "" });
          onEdit();
          renderChecklist(items.length - 1);
        },
      },
      icon("plus", "ic"),
      "Добавить пункт"
    )
  );
  if (items.length) {
    list.appendChild(
      h("div", { class: "cl-count" }, done + " из " + items.length + " готово")
    );
  }

  setBody(ed, list);
  if (focusIndex !== undefined) {
    const inputs = list.querySelectorAll(".cl-text");
    if (inputs[focusIndex]) inputs[focusIndex].focus();
  }
}

function legendChip(id) {
  return h(
    "span",
    { class: "legend-chip" },
    h("span", { class: "who-dot " + id }),
    nameOf(id)
  );
}

function renderBlame(container, tokens) {
  container.replaceChildren();
  if (!tokens.length) {
    container.appendChild(h("span", { class: "card-empty" }, "Пустая заметка"));
    return;
  }
  // склеиваем подряд идущие токены одного автора
  let curAuthor = null;
  let buf = "";
  const flush = () => {
    if (buf === "") return;
    container.appendChild(h("span", { class: "blame-seg " + curAuthor }, buf));
    buf = "";
  };
  for (const t of tokens) {
    if (t.a !== curAuthor) {
      flush();
      curAuthor = t.a;
    }
    buf += t.t;
  }
  flush();
}

function timeline(history) {
  const tl = h("div", { class: "timeline" }, h("h4", {}, "История изменений"));
  if (!history || !history.length) {
    tl.appendChild(h("div", { class: "tl-main", style: "color:var(--text-3)" }, "Пока без правок"));
    return tl;
  }
  history.forEach((r) => {
    const a = r.author;
    let verb;
    if (r.kind === "create") verb = (VERB.create[a] || "создал") + " заметку";
    else if (r.ins || r.del) verb = VERB.edit[a] || "изменил";
    else if (r.titleChanged) verb = VERB.rename[a] || "переименовал";
    else verb = VERB.edit[a] || "изменил";

    const detail = [];
    if (r.titleChanged) {
      detail.push(
        r.titleFrom
          ? h("div", { class: "tl-rename" }, "Заголовок: ", h("b", {}, "«" + r.titleFrom + "»"), " → ", h("b", {}, "«" + r.titleTo + "»"))
          : h("div", { class: "tl-rename" }, "Заголовок: ", h("b", {}, "«" + r.titleTo + "»"))
      );
    }
    if (r.ins) {
      detail.push(
        h(
          "div",
          { class: "tl-chip tl-ins " + a },
          h("span", { class: "tl-mark" }, "+"),
          h("span", { class: "tl-text" }, r.ins + (r.insTrunc ? "…" : ""))
        )
      );
    }
    if (r.del) {
      detail.push(
        h(
          "div",
          { class: "tl-chip tl-del" },
          h("span", { class: "tl-mark" }, "−"),
          h("span", { class: "tl-text" }, r.del + (r.delTrunc ? "…" : ""))
        )
      );
    }

    tl.appendChild(
      h(
        "div",
        { class: "tl-item" },
        h("span", { class: "tl-node " + a }),
        h(
          "div",
          {},
          h("div", { class: "tl-main" }, h("b", {}, nameOf(a)), " " + verb),
          h("div", { class: "tl-when" }, fullTime(r.created_at)),
          detail.length ? h("div", { class: "tl-diff" }, ...detail) : null
        )
      )
    );
  });
  return tl;
}

function autoGrow(ta) {
  ta.style.height = "auto";
  ta.style.height = Math.max(ta.scrollHeight, 240) + "px";
}

function onEdit() {
  const ed = state.editor;
  if (!ed) return;
  ed.dirty = true;
  ed.everTyped = true;
  if (ed.body) autoGrow(ed.body);
  setSaveState("saving", "Сохранение…");
  clearTimeout(ed.saveTimer);
  ed.saveTimer = setTimeout(saveNote, 750);
}

function setSaveState(cls, text) {
  const el = state.editor && state.editor.saveState;
  if (!el) return;
  el.className = "save-state " + cls;
  el.textContent = text;
}

async function saveNote() {
  const ed = state.editor;
  if (!ed || ed.saving) return;
  const title = ed.titleInput.value;
  const content = ed.getContent
    ? ed.getContent()
    : ed.body
    ? ed.body.value
    : ed.note.content || "";
  ed.saving = true;
  try {
    const { note } = await api("/api/notes/" + ed.note.id, "PUT", {
      title,
      content,
      baseUpdatedAt: ed.note.updated_at,
    });
    ed.note = note;
    ed.dirty = false;
    ed.conflictShown = false;
    setSaveState("saved", "Сохранено");
    updateListItem(note);
    refreshStreak();
  } catch (err) {
    if (err.status === 409) {
      // конфликт: на сервере уже новее
      setSaveState("", "");
      handleConflict(err.data && err.data.note);
    } else if (err.status !== 401) {
      setSaveState("err", "Ошибка сохранения");
      toast("Не удалось сохранить", "err");
    }
  } finally {
    ed.saving = false;
    // если за время сохранения снова напечатали - сохранить ещё раз
    if (ed.dirty && !ed.saveTimer) {
      ed.saveTimer = setTimeout(saveNote, 600);
    }
  }
}

function handleConflict(remoteNote) {
  const ed = state.editor;
  if (!ed || ed.conflictShown) return;
  ed.conflictShown = true;
  const who = remoteNote ? nameOf(remoteNote.updated_by) : "Кто-то";
  toast(who + " тоже " + VERB.edit[remoteNote ? remoteNote.updated_by : "kirill"] + " эту заметку", "info", {
    label: "Обновить",
    fn: () => {
      if (remoteNote) {
        ed.note = remoteNote;
        if (ed.titleInput) ed.titleInput.value = remoteNote.title || "";
        ed.dirty = false;
        renderEditorBody();
        setSaveState("saved", "Обновлено");
      }
    },
  });
}

function updateListItem(note) {
  const idx = state.notes.findIndex((n) => n.id === note.id);
  const item = {
    id: note.id,
    title: note.title,
    preview: (note.content || "").replace(/\s+/g, " ").trim().slice(0, 180),
    empty: !(note.content || "").trim() && !(note.title || "").trim(),
    color: note.color,
    pinned: note.pinned,
    checklist: !!note.checklist,
    created_by: note.created_by,
    created_at: note.created_at,
    updated_by: note.updated_by,
    updated_at: note.updated_at,
  };
  if (idx > -1) state.notes[idx] = item;
  else state.notes.unshift(item);
}

// ---------- закрепить / цвет / удалить ----------
// Переключение обычной заметки в чек-лист и обратно
async function toggleChecklist(btn) {
  const ed = state.editor;
  if (!ed) return;
  const next = !ed.note.checklist;

  // текущий текст берём из того, что сейчас на экране
  const cur = ed.getContent ? ed.getContent() : ed.body ? ed.body.value : ed.note.content || "";
  ed.note.content = next ? toChecklist(cur) : fromChecklist(cur);
  ed.note.checklist = next;
  ed.clItems = null;
  ed.getContent = null;

  btn.classList.toggle("on", next);
  if (state.reveal) {
    state.reveal = false;
    document.body.classList.remove("reveal");
  }
  renderEditorBody();
  onEdit();
  try {
    await api("/api/notes/" + ed.note.id, "PATCH", { checklist: next });
    updateListItem(ed.note);
  } catch (err) {
    if (err.status !== 401) toast("Не получилось", "err");
  }
}

async function togglePin(btn) {
  const ed = state.editor;
  if (!ed) return;
  const next = !ed.note.pinned;
  ed.note.pinned = next;
  btn.classList.toggle("on", next);
  btn.innerHTML = next ? I.pinFill : I.pin;
  try {
    await api("/api/notes/" + ed.note.id, "PATCH", { pinned: next });
    updateListItem(ed.note);
    toast(next ? "Закреплено" : "Откреплено", "ok");
  } catch (err) {
    if (err.status !== 401) toast("Не получилось", "err");
  }
}

function openPalette(anchor) {
  const ed = state.editor;
  if (!ed) return;
  const existing = document.querySelector(".popover");
  if (existing) {
    existing.remove();
    return;
  }
  const colors = ["default", "mint", "teal", "gold", "rose"];
  const pop = h(
    "div",
    { class: "popover" },
    h(
      "div",
      { class: "swatches" },
      ...colors.map((c) =>
        h("button", {
          class: "swatch sw-" + c + (ed.note.color === c ? " sel" : ""),
          "aria-label": "Цвет " + c,
          onclick: async () => {
            ed.note.color = c;
            pop.remove();
            try {
              await api("/api/notes/" + ed.note.id, "PATCH", { color: c });
              updateListItem(ed.note);
            } catch (err) {
              if (err.status !== 401) toast("Не получилось", "err");
            }
          },
        })
      )
    )
  );
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

function confirmDelete() {
  const ed = state.editor;
  if (!ed) return;
  const scrim = h(
    "div",
    { class: "modal-scrim", onclick: (e) => e.target === scrim && scrim.remove() },
    h(
      "div",
      { class: "modal glass" },
      h("h3", {}, "Удалить заметку?"),
      h("p", {}, "Заметка исчезнет у вас обоих. Отменить будет нельзя."),
      h(
        "div",
        { class: "modal-actions" },
        h("button", { class: "btn", onclick: () => scrim.remove() }, "Отмена"),
        h(
          "button",
          {
            class: "btn btn-primary",
            style: "background:linear-gradient(135deg,#fb7185,#f43f5e);color:#2a0710",
            onclick: async () => {
              scrim.remove();
              await doDelete(ed.note.id);
            },
          },
          "Удалить"
        )
      )
    )
  );
  document.body.appendChild(scrim);
}

async function doDelete(id) {
  try {
    await api("/api/notes/" + id, "DELETE");
    state.notes = state.notes.filter((n) => n.id !== id);
    state.editor.everTyped = false; // чтобы не пересоздать при закрытии
    closeEditor();
    renderGrid();
    toast("Заметка удалена", "ok");
  } catch (err) {
    if (err.status !== 401) toast("Не удалось удалить", "err");
  }
}

// ---------- закрытие редактора ----------
function closeEditor() {
  if (history.state && history.state.mn === "editor") history.back();
  else destroyEditor();
}

async function destroyEditor() {
  const ed = state.editor;
  const el = state.editorEl;
  stopNotePoll();
  if (ed && ed.saveTimer) clearTimeout(ed.saveTimer);

  // финальное сохранение, если остались несохранённые правки
  if (ed && ed.dirty && !ed.saving) {
    try {
      await saveNote();
    } catch {}
  }

  // пустую нетронутую заметку убираем
  if (ed && ed.note) {
    const emptyNow =
      !(ed.titleInput ? ed.titleInput.value.trim() : ed.note.title) &&
      !((ed.getContent ? ed.getContent() : ed.body ? ed.body.value : ed.note.content) || "")
        .replace(/-s[[ xX]]/g, "")
        .trim();
    if (emptyNow && !ed.everTyped) {
      try {
        await api("/api/notes/" + ed.note.id, "DELETE");
      } catch {}
      state.notes = state.notes.filter((n) => n.id !== ed.note.id);
    }
  }

  if (el) el.remove();
  state.editorEl = null;
  state.editor = null;
  document.querySelectorAll(".popover").forEach((p) => p.remove());
  renderGrid();
}

window.addEventListener("popstate", () => {
  if (state.editorEl) destroyEditor();
});

// ============================================================
//  СИНХРОНИЗАЦИЯ (опрос)
// ============================================================
function startListPoll() {
  stopListPoll();
  state.listPoll = setInterval(() => {
    if (document.hidden || state.editorEl) return;
    silentReloadList();
  }, 5000);
}
function stopListPoll() {
  if (state.listPoll) clearInterval(state.listPoll);
  state.listPoll = null;
}
async function silentReloadList() {
  try {
    const { notes } = await api("/api/notes");
    const changed = JSON.stringify(notes.map((n) => [n.id, n.updated_at, n.pinned, n.color])) !==
      JSON.stringify(state.notes.map((n) => [n.id, n.updated_at, n.pinned, n.color]));
    state.notes = notes;
    if (changed) renderGrid();
  } catch {}
}

function startNotePoll() {
  stopNotePoll();
  state.notePoll = setInterval(async () => {
    const ed = state.editor;
    if (!ed || document.hidden) return;
    try {
      const { note } = await api("/api/notes/" + ed.note.id + "?history=1");
      if (note.updated_at <= ed.note.updated_at) return;
      // кто-то другой сохранил свежую версию
      if (ed.dirty && note.updated_by !== state.me.user) {
        handleConflict(note);
        return;
      }
      // мы не редактируем прямо сейчас - подтягиваем без помех
      if (!ed.dirty) {
        ed.note = note;
        if (ed.titleInput && document.activeElement !== ed.titleInput)
          ed.titleInput.value = note.title || "";
        renderEditorBody();
      }
    } catch {}
  }, 5000);
}
function stopNotePoll() {
  if (state.notePoll) clearInterval(state.notePoll);
  state.notePoll = null;
}
function stopPolling() {
  stopListPoll();
  stopNotePoll();
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && state.me) {
    if (state.editorEl) {
      /* нотка сама подтянется опросом */
    } else silentReloadList();
  }
});

// ============================================================
//  МОТОРИКА (курсор-глоу, параллакс, тилт, магнит)
// ============================================================
function initMotion() {
  const glow = document.getElementById("cursorGlow");
  const blobs = [...document.querySelectorAll(".blob")];
  const mesh = document.querySelector(".bg-mesh");
  const target = { x: innerWidth / 2, y: innerHeight / 2 };
  const cur = { x: target.x, y: target.y };
  let moved = false;

  if (state.fine) {
    window.addEventListener("pointermove", (e) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (!moved) {
        moved = true;
        if (glow) glow.style.opacity = "1";
      }
    });
  }

  function frame() {
    cur.x += (target.x - cur.x) * 0.15;
    cur.y += (target.y - cur.y) * 0.15;
    if (glow) glow.style.transform = `translate(${cur.x}px, ${cur.y}px)`;

    const nx = (cur.x / innerWidth - 0.5) * 2;
    const ny = (cur.y / innerHeight - 0.5) * 2;
    blobs.forEach((b, i) => {
      const f = (i + 1) * 8;
      b.style.translate = `${nx * f}px ${ny * f}px`;
    });
    if (mesh) mesh.style.translate = `${nx * 14}px ${ny * 14}px`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ============================================================
//  СТАРТ
// ============================================================
async function boot() {
  initMotion();
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("/sw.js");
    } catch {}
  }
  try {
    const me = await api("/api/me");
    state.me = me;
    enterApp();
    startGamesBadge();
    refreshStreak();
    syncBell();
  } catch {
    renderLogin();
  }
}
boot();
