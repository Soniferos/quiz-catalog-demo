import { project } from "./config.mjs";

export const storageKey = `quiz-demo:${project.id}:v2`;
const key = storageKey;
const blankProfile = () => ({
  answers: { budgetBasis: "stay", guests: 2 },
  favorites: [],
  unlocked: null,
  filters: {},
});
export function readStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(key)) || {};
    const profile = (mode) => {
      const value = saved.profiles?.[mode] || {};
      return {
        ...blankProfile(),
        ...value,
        answers: { ...blankProfile().answers, ...value.answers },
        favorites: Array.isArray(value.favorites) ? value.favorites : [],
      };
    };
    return {
      events: Array.isArray(saved.events) ? saved.events : [],
      leads: Array.isArray(saved.leads) ? saved.leads : [],
      profiles: { sale: profile("sale"), rental: profile("rental") },
    };
  } catch {
    return {
      events: [],
      leads: [],
      profiles: { sale: blankProfile(), rental: blankProfile() },
    };
  }
}
export function saveStore(store) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ ...store, events: store.events.slice(-8000) }),
    );
  } catch {
    /* Storage may be disabled; the current in-memory demo still works. */
  }
}
export function getSession() {
  try {
    let id = sessionStorage.getItem(`${key}:session`);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(`${key}:session`, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
export function newSession() {
  const id = crypto.randomUUID();
  try {
    sessionStorage.setItem(`${key}:session`, id);
  } catch {
    /* In-memory fallback. */
  }
  return id;
}
export function safeSource() {
  return readAttribution().source;
}

const utmKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_source_platform",
  "utm_creative_format",
  "utm_marketing_tactic",
  "utm_city",
];
const clickIdKeys = [
  "gclid",
  "gbraid",
  "wbraid",
  "dclid",
  "gad_source",
  "yclid",
  "ymclid",
];

function cookieValue(name) {
  const part = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`));
  if (!part) return "";
  try {
    return decodeURIComponent(part.slice(name.length + 1));
  } catch {
    return "";
  }
}

function boundedValue(value) {
  return typeof value === "string" && value.length <= 300 ? value : "";
}

export function readAttribution() {
  const params = new URLSearchParams(location.search);
  const city = ["utm_city", "city", "geo_city", "location_city"]
    .map((key) => boundedValue(params.get(key) || ""))
    .find(Boolean) || "";
  const utm = Object.fromEntries(
    utmKeys
      .map((key) => [key, boundedValue(params.get(key) || "")])
      .filter(([, value]) => value),
  );
  const clickIds = Object.fromEntries(
    clickIdKeys
      .map((key) => [key, boundedValue(params.get(key) || "")])
      .filter(([, value]) => value),
  );
  let referrer = "";
  try {
    referrer = document.referrer ? new URL(document.referrer).hostname : "";
  } catch {
    referrer = "";
  }
  const rawSource = (utm.utm_source || "").toLowerCase();
  const source = /yandex|яндекс/.test(rawSource)
    ? "yandex"
    : /google/.test(rawSource)
      ? "google"
      : /telegram|t\.me/.test(rawSource)
        ? "telegram"
        : clickIds.yclid || clickIds.ymclid
          ? "yandex"
          : clickIds.gclid || clickIds.gbraid || clickIds.wbraid || clickIds.dclid
            ? "google"
        : /yandex|ya\.ru/.test(referrer)
          ? "yandex"
          : /google/.test(referrer)
            ? "google"
            : referrer
              ? "other"
              : "direct";
  const gaCookie = cookieValue("_ga");
  const yandexClientId = cookieValue("_ym_uid");
  const clientIds = {
    ...(gaCookie ? { googleAnalytics: gaCookie } : {}),
    ...(yandexClientId ? { yandexMetrica: yandexClientId } : {}),
  };
  return {
    source,
    sourceLabel:
      source === "google"
        ? "Google"
        : source === "yandex"
          ? "Яндекс"
          : source === "telegram"
            ? "Telegram"
            : source === "direct"
              ? "Прямой вход"
              : "Другой источник",
    capturedAt: Date.now(),
    landingPage: `${location.pathname}${location.hash}`,
    referrer,
    city,
    utm,
    clickIds,
    clientIds,
  };
}
