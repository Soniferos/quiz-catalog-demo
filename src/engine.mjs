export { validatePhone } from "./phone.mjs";
import { getQuestions } from "./config.mjs";

export function matchProperties(properties, answers) {
  return properties
    .filter((p) => p.available && Number.isFinite(p.price) && p.price > 0)
    .filter(
      (p) =>
        !answers.budget ||
        answers.budget === "any" ||
        p.price <= Number(answers.budget),
    )
    .filter(
      (p) =>
        !answers.rooms ||
        answers.rooms === "any" ||
        p.bedrooms === Number(answers.rooms),
    )
    .filter(
      (p) =>
        !answers.district ||
        answers.district === "any" ||
        p.district === answers.district,
    )
    .filter(
      (p) =>
        !answers.handover ||
        answers.handover === "any" ||
        (answers.handover === "ready"
          ? p.ready
          : p.year <= Number(answers.handover)),
    )
    .map((p) => ({
      ...p,
      priority:
        answers.goal && answers.goal !== "any" && p.goals.includes(answers.goal)
          ? 1
          : 0,
    }))
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        a.price - b.price ||
        a.id.localeCompare(b.id),
    );
}

export function matchReasons(property, answers, districts) {
  return [
    answers.budget && answers.budget !== "any" ? "В вашем бюджете" : null,
    answers.rooms && answers.rooms !== "any"
      ? `${property.bedrooms} ${property.bedrooms === 1 ? "спальня" : "спальни"}`
      : null,
    answers.district && answers.district !== "any"
      ? districts[property.district]
      : null,
    answers.handover && answers.handover !== "any"
      ? property.ready
        ? "Готов к заселению"
        : `Готовность до ${answers.handover}`
      : null,
    answers.goal &&
    answers.goal !== "any" &&
    property.goals.includes(answers.goal)
      ? "Под вашу цель покупки"
      : null,
  ].filter(Boolean);
}

export const funnelSteps = [
  ["visit", "Открыли подбор"],
  ["start", "Начали квиз"],
  ["question_rooms", "Спальни"],
  ["question_budget", "Бюджет"],
  ["question_goal", "Цель покупки"],
  ["question_viewing", "Просмотр"],
  ["preview", "Превью подборки"],
  ["contact", "Форма открытия"],
  ["lead", "Тестовый контакт принят"],
  ["results", "Получили подборку"],
  ["request", "Запрос по объектам"],
];

export function stepsFor(mode = "sale") {
  return mode === "sale"
    ? funnelSteps
    : [
        ...funnelSteps.slice(0, 2),
        ...getQuestions("rental").map((q) => [`question_${q.id}`, q.short]),
        ...funnelSteps.slice(6),
      ];
}

// A session advances only in order; direct preview entries cannot inflate a sequential funnel.
export function buildFunnel(events, filters = {}) {
  const steps = stepsFor(filters.profile || "sale");
  const grouped = new Map();
  const seen = new Set();
  for (const event of [...events].sort((a, b) => a.at - b.at)) {
    if (!event.id || seen.has(event.id)) continue;
    seen.add(event.id);
    if (event.preview || (filters.dataset && event.dataset !== filters.dataset))
      continue;
    if (event.version && event.version !== "2.0") continue;
    if (filters.profile && event.profile !== filters.profile) continue;
    if (filters.source && event.source !== filters.source) continue;
    if (filters.device && event.device !== filters.device) continue;
    if (filters.since && event.at < filters.since) continue;
    if (!grouped.has(event.session)) grouped.set(event.session, []);
    grouped.get(event.session).push(event);
  }
  const counts = steps.map(() => 0);
  for (const session of grouped.values()) {
    let next = 0;
    for (const event of session)
      if (event.name === steps[next]?.[0]) {
        counts[next] += 1;
        next += 1;
      }
  }
  return steps.map(([id, label], i) => ({
    id,
    label,
    count: counts[i],
    totalRate: counts[0] ? counts[i] / counts[0] : null,
    stepRate: i && counts[i - 1] ? counts[i] / counts[i - 1] : null,
  }));
}

export function upsertDemoLead(leads, incoming) {
  const existing = leads.find(
    (l) =>
      l.session === incoming.session &&
      l.profile === incoming.profile &&
      l.intent === incoming.intent,
  );
  if (!existing) return [{ ...incoming }, ...leads];
  return leads.map((l) =>
    l.id === existing.id
      ? {
          ...l,
          ...incoming,
          id: l.id,
          createdAt: l.createdAt,
          objectIds: [...new Set([...l.objectIds, ...incoming.objectIds])],
          stage: l.stage,
        }
      : l,
  );
}

export function fixtureEvents(mode = "sale") {
  const questions = getQuestions(mode);
  const steps = stepsFor(mode);
  const now = Date.now();
  return Array.from({ length: 36 }, (_, i) => {
    const depth =
      i < 5
        ? steps.length
        : i < 13
          ? steps.length - 1
          : i < 19
            ? steps.length - 3
            : i < 25
              ? 5
              : i < 30
                ? 2
                : 1;
    return steps.slice(0, depth).flatMap(([name], step) => {
      const event = {
        id: `sample-${mode}-${i}-${step}`,
        session: `sample-${mode}-${i}`,
        name,
        at: now - (36 - i) * 900000 + step * 2000,
        source: i % 3 ? "google" : "yandex",
        device: i % 4 ? "mobile" : "desktop",
        dataset: "sample",
        preview: false,
        version: "2.0",
        profile: mode,
      };
      const question = questions.find((q) => `question_${q.id}` === name);
      return question?.options?.length && step < depth - 1
        ? [
            event,
            {
              ...event,
              id: `${event.id}-answer`,
              name: "answer",
              at: event.at + 1000,
              step: question.id,
              value: question.options[i % question.options.length].value,
            },
          ]
        : [event];
    });
  }).flat();
}
