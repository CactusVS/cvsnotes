import { randomUUID } from "node:crypto";
import {
  USERS,
  verb,
  publicUsers,
  checkPassword,
  passwordOf,
  makeToken,
  verifyToken,
  sessionCookie,
  clearCookie,
  readSessionCookie,
} from "../../lib/auth.mjs";
import { reblame, spanDiff, textFromTokens } from "../../lib/diff.mjs";
import * as store from "../../lib/store.mjs";
import {
  CATALOG,
  catalogEntry,
  createGame,
  applyMove,
  viewGame,
  turnOf,
  summary,
  buildStats,
} from "../../lib/games/index.mjs";
import { light, getStreak } from "../../lib/activity.mjs";
import * as push from "../../lib/push.mjs";

export const config = { path: "/api/*" };

// ---------- утилиты ----------
function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}
const uid = () => randomUUID();
const isHttps = (url) => url.protocol === "https:";
const secret = () => process.env.SESSION_SECRET || "insecure-fallback-secret-set-SESSION_SECRET";

function preview(text, limit = 180) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > limit ? clean.slice(0, limit) : clean;
}
async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
async function currentUser(request) {
  const token = readSessionCookie(request);
  if (!token) return null;
  return await verifyToken(token, secret());
}

const otherUser = (id) => (id === "angelina" ? "kirill" : "angelina");

function noteListItem(note) {
  const text = textFromTokens(note.tokens || []);
  return {
    id: note.id,
    title: note.title,
    preview: preview(text),
    empty: text.trim() === "" && (note.title || "").trim() === "",
    color: note.color,
    pinned: !!note.pinned,
    checklist: !!note.checklist,
    created_by: note.created_by,
    created_at: note.created_at,
    updated_by: note.updated_by,
    updated_at: note.updated_at,
  };
}

function noteFull(note, revs) {
  const out = {
    id: note.id,
    title: note.title,
    content: textFromTokens(note.tokens || []),
    tokens: note.tokens || [],
    color: note.color,
    pinned: !!note.pinned,
    checklist: !!note.checklist,
    created_by: note.created_by,
    created_at: note.created_at,
    updated_by: note.updated_by,
    updated_at: note.updated_at,
  };
  if (revs) out.history = revs.slice().reverse(); // новые сверху
  return out;
}

// ---------- обработчики ----------
async function handleLogin(request, url) {
  const { user, password } = await readBody(request);
  const userId = String(user || "").toLowerCase();
  if (!USERS[userId]) {
    return json({ error: "Неверный пользователь или пароль" }, { status: 401 });
  }
  // пароль не задан в окружении - это ошибка настройки, а не неверный ввод
  if (!passwordOf(userId)) {
    return json(
      { error: "Сервер не настроен: не задана переменная " + USERS[userId].env },
      { status: 503 }
    );
  }
  if (!checkPassword(userId, String(password || ""))) {
    return json({ error: "Неверный пользователь или пароль" }, { status: 401 });
  }
  const token = await makeToken(userId, secret());
  return json(
    { user: userId, name: USERS[userId].name },
    { headers: { "Set-Cookie": sessionCookie(token, isHttps(url)) } }
  );
}

async function listNotes() {
  const notes = await store.listNotes();
  return json({ notes: notes.map(noteListItem) });
}

async function getNoteHandler(id, includeHistory) {
  const note = await store.getNote(id);
  if (!note) return json({ error: "Заметка не найдена" }, { status: 404 });
  const revs = includeHistory ? await store.getRevisions(id) : null;
  return json({ note: noteFull(note, revs) });
}

async function createNote(userId) {
  const now = Date.now();
  const note = {
    id: uid(),
    title: "",
    tokens: [],
    color: "default",
    pinned: false,
    created_by: userId,
    created_at: now,
    updated_by: userId,
    updated_at: now,
  };
  await store.putNote(note);
  const rev = {
    id: uid(),
    author: userId,
    created_at: now,
    kind: "create",
    ins: "",
    del: "",
    added: 0,
    removed: 0,
    titleChanged: 0,
  };
  await store.setRevisions(note.id, [rev]);
  return json({ note: noteFull(note, [rev]) });
}

async function updateNote(request, userId, id) {
  const body = await readBody(request);
  const note = await store.getNote(id);
  if (!note) return json({ error: "Заметка не найдена" }, { status: 404 });

  const prevTokens = note.tokens || [];
  const oldContent = textFromTokens(prevTokens);
  const oldTitle = note.title || "";
  const newTitle = body.title !== undefined ? String(body.title) : oldTitle;
  const hasContent = body.content !== undefined;
  const newContent = hasContent ? String(body.content) : oldContent;

  // конфликт: клиент правил старую версию
  if (body.baseUpdatedAt !== undefined && Number(body.baseUpdatedAt) < note.updated_at) {
    return json({ conflict: true, note: noteFull(note, null) }, { status: 409 });
  }

  const { tokens, added, removed } = reblame(prevTokens, newContent, userId);
  const { ins, del } = spanDiff(oldContent, newContent);
  const titleChanged = newTitle !== oldTitle;
  const now = Date.now();

  note.title = newTitle;
  note.tokens = tokens;
  note.updated_by = userId;
  note.updated_at = now;
  await store.putNote(note);

  let revs = await store.getRevisions(id);
  if (added > 0 || removed > 0 || titleChanged) {
    const rev = {
      id: uid(),
      author: userId,
      created_at: now,
      kind: "edit",
      ins: ins.slice(0, 800),
      del: del.slice(0, 800),
      insTrunc: ins.length > 800,
      delTrunc: del.length > 800,
      added,
      removed,
      titleChanged: titleChanged ? 1 : 0,
      titleFrom: titleChanged ? oldTitle : "",
      titleTo: titleChanged ? newTitle : "",
    };
    revs = await store.appendRevision(id, rev);
    // уведомляем второго, но не заваливаем: только если правка заметная
    if (ins.length > 1 || titleChanged) {
      const label = newTitle.trim() || preview(newContent, 40) || "Без названия";
      push
        .send(otherUser(userId), {
          title: USERS[userId].name + " пишет заметку",
          body: label,
          tag: "note-" + id,
          url: "/",
        }, "notes")
        .catch(() => {});
    }
  }
  return json({ note: noteFull(note, revs) });
}

async function patchNote(request, userId, id) {
  const body = await readBody(request);
  const note = await store.getNote(id);
  if (!note) return json({ error: "Заметка не найдена" }, { status: 404 });
  if (body.pinned !== undefined) note.pinned = !!body.pinned;
  if (body.color !== undefined) note.color = String(body.color);
  if (body.checklist !== undefined) note.checklist = !!body.checklist;
  await store.putNote(note);
  return json({ ok: true });
}

async function deleteNote(id) {
  const note = await store.getNote(id);
  if (!note) return json({ error: "Заметка не найдена" }, { status: 404 });
  await store.deleteNote(id);
  return json({ ok: true });
}

// ---------- игры ----------

// Наружу отдаём только view(): сырое состояние содержит секреты обоих игроков
function gameResponse(game, userId) {
  const entry = catalogEntry(game.type);
  return {
    ...summary(game, userId),
    tagline: entry ? entry.tagline : "",
    rules: entry ? entry.rules : [],
    view: viewGame(game, userId),
  };
}

async function listGamesHandler(userId) {
  const games = await store.listGames();
  return json({
    games: games.map((g) => summary(g, userId)),
    catalog: CATALOG,
  });
}

async function createGameHandler(request, userId) {
  const body = await readBody(request);
  const type = String(body.type || "");
  const entry = catalogEntry(type);
  if (!entry) return json({ error: "Нет такой игры" }, { status: 400 });

  let variant = null;
  if (entry.variants && entry.variants.length) {
    const ids = entry.variants.map((v) => v.id);
    variant = ids.includes(body.variant) ? body.variant : ids[0];
  }

  const res = createGame(type, userId, { variant });
  if (res.error) return json({ error: res.error }, { status: 400 });

  const now = Date.now();
  const game = {
    id: uid(),
    type,
    variant,
    created_by: userId,
    created_at: now,
    updated_at: now,
    status: "active",
    winner: null,
    state: res.state,
  };
  await store.putGame(game);
  return json({ game: gameResponse(game, userId) });
}

async function getGameHandler(id, userId) {
  const game = await store.getGame(id);
  if (!game) return json({ error: "Игра не найдена" }, { status: 404 });
  return json({ game: gameResponse(game, userId) });
}

async function moveHandler(request, id, userId) {
  const body = await readBody(request);
  const game = await store.getGame(id);
  if (!game) return json({ error: "Игра не найдена" }, { status: 404 });

  const res = applyMove(game, userId, body.action);
  if (res && res.error) {
    // состояние не изменилось, но вернём актуальное - вдруг соперник уже походил
    return json({ error: res.error, game: gameResponse(game, userId) }, { status: 400 });
  }
  game.updated_at = Date.now();
  await store.putGame(game);

  const entry = catalogEntry(game.type);
  const gameName = entry ? entry.title : "игра";
  const foe = otherUser(userId);
  if (game.status !== "active") {
    const body =
      game.winner === "both"
        ? "Прошли вместе!"
        : game.winner === userId
        ? USERS[userId].name + " " + verb(userId, "победил", "победила")
        : "Партия окончена";
    push.send(foe, { title: gameName, body, tag: "game-" + game.id, url: "/" }, "result").catch(() => {});
  } else if (turnOf(game) === foe) {
    push
      .send(foe, {
        title: gameName,
        body: "Твой ход",
        tag: "game-" + game.id,
        url: "/",
      }, "turn")
      .catch(() => {});
  }
  return json({ game: gameResponse(game, userId), result: res });
}

async function deleteGameHandler(id) {
  const game = await store.getGame(id);
  if (!game) return json({ error: "Игра не найдена" }, { status: 404 });
  await store.deleteGame(id);
  return json({ ok: true });
}

async function statsHandler() {
  const games = await store.listGames();
  return json(buildStats(games));
}

// ---------- роутер ----------
export default async function handler(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  try {
    if (path === "/api/login" && method === "POST") return await handleLogin(request, url);
    if (path === "/api/logout" && method === "POST")
      return json({ ok: true }, { headers: { "Set-Cookie": clearCookie(isHttps(url)) } });

    const userId = await currentUser(request);
    if (!userId) return json({ error: "Не авторизован" }, { status: 401 });

    // огонёк и пуши
    if (path === "/api/streak" && method === "GET") return json(await getStreak());
    if (path === "/api/streak/light" && method === "POST") {
      const res = await light(userId);
      // если зажёг только один, зовём второго
      if (!res.both) {
        push
          .send(otherUser(userId), {
            title: "Огонёк ждёт",
            body: USERS[userId].name + " " + verb(userId, "зажёг", "зажгла") + " огонёк. Твоя очередь",
            tag: "flame",
            url: "/",
          }, "flame")
          .catch(() => {});
      }
      return json(await getStreak());
    }
    if (path === "/api/push/key" && method === "GET")
      return json({
        key: push.publicKey(),
        enabled: await push.hasSubscription(userId),
        // чтобы было видно, какой именно переменной не хватает на сервере
        missing: push.missingKeys(),
        kinds: push.PREF_KINDS,
        prefs: await push.getPrefs(userId),
      });
    if (path === "/api/push/subscribe" && method === "POST") {
      const body = await readBody(request);
      if (!body.subscription || !body.subscription.endpoint)
        return json({ error: "Нет подписки" }, { status: 400 });
      await push.subscribe(userId, body.subscription);
      await push.send(userId, {
        title: "Уведомления включены",
        body: "Теперь сообщу, когда твой ход или новая заметка",
        tag: "hello",
        url: "/",
      });
      return json({ ok: true });
    }
    if (path === "/api/push/prefs" && method === "POST") {
      const body = await readBody(request);
      return json({ prefs: await push.setPrefs(userId, body.prefs || {}) });
    }
    if (path === "/api/push/unsubscribe" && method === "POST") {
      const body = await readBody(request);
      await push.unsubscribe(userId, String(body.endpoint || ""));
      return json({ ok: true });
    }

    if (path === "/api/me" && method === "GET")
      return json({ user: userId, name: USERS[userId].name, users: publicUsers() });
    if (path === "/api/notes" && method === "GET") return await listNotes();
    if (path === "/api/notes" && method === "POST") return await createNote(userId);

    const m = path.match(/^\/api\/notes\/([A-Za-z0-9-]+)$/);
    if (m) {
      const id = m[1];
      if (method === "GET")
        return await getNoteHandler(id, url.searchParams.get("history") === "1");
      if (method === "PUT") return await updateNote(request, userId, id);
      if (method === "PATCH") return await patchNote(request, userId, id);
      if (method === "DELETE") return await deleteNote(id);
    }

    // игры. /stats проверяем до /:id, иначе id перехватит это слово
    if (path === "/api/games" && method === "GET") return await listGamesHandler(userId);
    if (path === "/api/games" && method === "POST") return await createGameHandler(request, userId);
    if (path === "/api/games/stats" && method === "GET") return await statsHandler();

    const gmv = path.match(/^\/api\/games\/([A-Za-z0-9-]+)\/move$/);
    if (gmv && method === "POST") return await moveHandler(request, gmv[1], userId);

    const gm = path.match(/^\/api\/games\/([A-Za-z0-9-]+)$/);
    if (gm) {
      const id = gm[1];
      if (method === "GET") return await getGameHandler(id, userId);
      if (method === "DELETE") return await deleteGameHandler(id);
    }

    return json({ error: "Не найдено" }, { status: 404 });
  } catch (err) {
    return json({ error: "Ошибка сервера", detail: String(err) }, { status: 500 });
  }
}
