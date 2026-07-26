// Пуш-уведомления через Web Push. Ключи VAPID лежат в переменных окружения.
import webpush from "web-push";
import { getStore } from "@netlify/blobs";

const store = () => getStore({ name: "push", consistency: "strong" });

export function publicKey() {
  return process.env.VAPID_PUBLIC_KEY || "";
}

// Какие переменные не заданы - чтобы клиент показал понятную ошибку
export function missingKeys() {
  const miss = [];
  if (!process.env.VAPID_PUBLIC_KEY) miss.push("VAPID_PUBLIC_KEY");
  if (!process.env.VAPID_PRIVATE_KEY) miss.push("VAPID_PRIVATE_KEY");
  return miss;
}

function ready() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:noreply@example.com", pub, priv);
  return true;
}

export async function subscribe(userId, subscription) {
  const list = (await store().get(userId, { type: "json" })) || [];
  // один и тот же браузер не дублируем
  if (!list.some((s) => s.endpoint === subscription.endpoint)) {
    list.push(subscription);
    if (list.length > 8) list.splice(0, list.length - 8);
    await store().setJSON(userId, list);
  }
  return list.length;
}

export async function unsubscribe(userId, endpoint) {
  const list = (await store().get(userId, { type: "json" })) || [];
  const next = list.filter((s) => s.endpoint !== endpoint);
  await store().setJSON(userId, next);
  return next.length;
}

export async function hasSubscription(userId) {
  const list = (await store().get(userId, { type: "json" })) || [];
  return list.length > 0;
}

// Отправить уведомление пользователю. Ошибки не роняют основной запрос.
export async function send(userId, payload) {
  if (!ready()) return { skipped: "no-keys" };
  const list = (await store().get(userId, { type: "json" })) || [];
  if (!list.length) return { skipped: "no-subs" };

  const dead = [];
  await Promise.all(
    list.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
      } catch (err) {
        // 404/410 - подписка протухла, выкидываем
        const code = err && err.statusCode;
        if (code === 404 || code === 410) dead.push(sub.endpoint);
      }
    })
  );
  if (dead.length) {
    const next = list.filter((s) => !dead.includes(s.endpoint));
    await store().setJSON(userId, next);
  }
  return { sent: list.length - dead.length };
}
