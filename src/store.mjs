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
  const source = new URLSearchParams(location.search).get("utm_source");
  return ["yandex", "google", "telegram"].includes(source) ? source : "direct";
}
