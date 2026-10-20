import { properties, getQuestions } from "./config.mjs";

export const rentals = properties.slice(0, 8).map((p, i) => ({
  ...p,
  id: `r${String(i + 1).padStart(2, "0")}`,
  category: p.type === "Вилла" ? "villa" : "apartment",
  capacity: p.bedrooms * 2,
  nightly: [65, 110, 80, 125, 95, 270, 55, 220][i],
  cleaning: p.bedrooms === 3 ? 90 : 45,
  deposit: p.bedrooms === 3 ? 500 : 200,
  servicePercent: 5,
  minNights: p.bedrooms === 3 ? 5 : 3,
  calendar:
    i === 6
      ? null
      : {
          from: "2026-11-01",
          to: "2027-04-01",
          blocked: i === 1 ? [{ from: "2026-11-10", to: "2026-11-16" }] : [],
        },
  seasons: [{ from: "2026-12-01", to: "2027-02-01", multiplier: 1.3 }],
}));
const dayMs = 86400000;
function dateNumber(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return NaN;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value
    ? time
    : NaN;
}
export function tripLength(from, to) {
  const n = (dateNumber(to) - dateNumber(from)) / dayMs;
  return Number.isInteger(n) && n > 0 && n <= 180 ? n : null;
}
export function rentalQuote(property, answers) {
  const nights = tripLength(answers.arrival, answers.departure);
  if (!nights)
    return { status: "invalid", reason: "Укажите даты: от 1 до 180 ночей" };
  if (
    !Number.isInteger(Number(answers.guests)) ||
    Number(answers.guests) < 1 ||
    Number(answers.guests) > property.capacity
  )
    return { status: "unavailable", reason: "Недостаточно мест для гостей" };
  if (nights < property.minNights)
    return {
      status: "unavailable",
      reason: `Минимум ${property.minNights} ночей`,
    };
  if (!Number.isFinite(property.nightly) || property.nightly <= 0)
    return { status: "unavailable", reason: "Нет тарифа" };
  const calendar = property.calendar;
  const known =
    !!calendar &&
    answers.arrival >= calendar.from &&
    answers.departure <= calendar.to;
  if (
    calendar?.blocked.some(
      (b) => answers.arrival < b.to && answers.departure > b.from,
    )
  )
    return {
      status: "unavailable",
      reason: "Даты заняты в тестовом календаре",
    };
  let accommodation = 0;
  for (
    let time = dateNumber(answers.arrival);
    time < dateNumber(answers.departure);
    time += dayMs
  ) {
    const date = new Date(time).toISOString().slice(0, 10);
    const season = property.seasons.find((s) => date >= s.from && date < s.to);
    accommodation += property.nightly * (season?.multiplier || 1);
  }
  accommodation = Math.round(accommodation * 100) / 100;
  const service = Math.round(accommodation * property.servicePercent) / 100;
  const total =
    Math.round((accommodation + property.cleaning + service) * 100) / 100;
  return {
    status: known ? "available" : "unknown",
    nights,
    accommodation,
    cleaning: property.cleaning,
    service,
    total,
    deposit: property.deposit,
    average: total / nights,
  };
}
export function matchRentals(items, answers) {
  return items
    .filter(
      (p) =>
        p.available &&
        (!answers.type ||
          answers.type === "any" ||
          p.category === answers.type),
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
    .map((p) => ({ ...p, quote: rentalQuote(p, answers) }))
    .filter((p) => ["available", "unknown"].includes(p.quote.status))
    .filter(
      (p) =>
        !answers.budget ||
        answers.budget === "any" ||
        (answers.budgetBasis === "night" ? p.quote.average : p.quote.total) <=
          Number(answers.budget),
    )
    .sort(
      (a, b) =>
        (a.quote.status === "unknown") - (b.quote.status === "unknown") ||
        a.quote.total - b.quote.total,
    );
}
export function selectionSignature(mode, answers) {
  return JSON.stringify([
    mode,
    ...getQuestions(mode).map((q) =>
      q.id === "dates"
        ? [answers.arrival, answers.departure, answers.guests]
        : answers[q.id] || null,
    ),
    mode === "rental" ? answers.budgetBasis : null,
  ]);
}
export function scoreProperty(property, answers) {
  const criteria = [
    [answers.rooms, 50, property.bedrooms === Number(answers.rooms)],
    [answers.budget, 35, property.price <= Number(answers.budget)],
    [answers.goal, 15, property.goals.includes(answers.goal)],
  ];
  const active = criteria.filter(([value]) => value && value !== "any");
  if (!active.length) return null;
  return Math.round(
    (active.reduce((n, [, w, matches]) => n + (matches ? w : 0), 0) /
      active.reduce((n, [, w]) => n + w, 0)) *
      100,
  );
}
