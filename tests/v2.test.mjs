import test from "node:test";
import assert from "node:assert/strict";
import { getQuestions, properties } from "../src/config.mjs";
import {
  buildFunnel,
  stepsFor,
  upsertDemoLead,
  fixtureEvents,
} from "../src/engine.mjs";
import {
  rentals,
  rentalQuote,
  matchRentals,
  tripLength,
  selectionSignature,
  scoreProperty,
} from "../src/rental.mjs";

const trip = {
  arrival: "2026-11-05",
  departure: "2026-11-12",
  guests: 2,
  type: "any",
  rooms: "any",
  district: "any",
  budget: "2500",
  budgetBasis: "stay",
};
test("sale has four Polish-pattern questions, rental retains five useful steps", () => {
  assert.deepEqual(
    getQuestions("sale").map((q) => q.id),
    ["rooms", "budget", "goal", "viewing"],
  );
  assert.equal(getQuestions("rental").length, 5);
});
test("strict civil dates and stay boundaries", () => {
  assert.equal(tripLength("2026-02-30", "2026-03-03"), null);
  assert.equal(tripLength("2026-11-05", "2026-11-05"), null);
  assert.equal(tripLength("2026-11-05", "2026-11-12"), 7);
  assert.equal(tripLength("2026-11-05", "2028-11-12"), null);
});
test("rental total includes cleaning and service but lists refundable deposit separately", () => {
  const q = rentalQuote(rentals[0], trip);
  assert.equal(q.accommodation, 455);
  assert.equal(q.service, 22.75);
  assert.equal(q.total, 522.75);
  assert.equal(q.deposit, 200);
  assert.equal(q.status, "available");
});
test("seasonal rates are calculated night by night", () => {
  const q = rentalQuote(rentals[0], {
    ...trip,
    arrival: "2026-11-29",
    departure: "2026-12-03",
  });
  assert.equal(q.accommodation, 299);
  assert.equal(q.total, 358.95);
});
test("occupied dates are excluded; checkout boundary is nonoverlapping", () => {
  assert.equal(
    rentalQuote(rentals[1], {
      ...trip,
      arrival: "2026-11-09",
      departure: "2026-11-12",
    }).status,
    "unavailable",
  );
  assert.equal(
    rentalQuote(rentals[1], {
      ...trip,
      arrival: "2026-11-07",
      departure: "2026-11-10",
    }).status,
    "available",
  );
});
test("capacity and minimum stay are hard limits", () => {
  assert.equal(
    rentalQuote(rentals[0], { ...trip, guests: 3 }).status,
    "unavailable",
  );
  assert.equal(
    rentalQuote(rentals[0], { ...trip, departure: "2026-11-06" }).status,
    "unavailable",
  );
});
test("unknown and out-of-calendar availability never become confirmed", () => {
  assert.equal(rentalQuote(rentals[6], trip).status, "unknown");
  assert.equal(
    rentalQuote(rentals[0], {
      ...trip,
      arrival: "2027-05-01",
      departure: "2027-05-10",
    }).status,
    "unknown",
  );
});
test("rental budgets use explicit stay or average-night units including fees", () => {
  const stay = matchRentals(rentals, { ...trip, budget: "600" });
  assert.ok(stay.every((p) => p.quote.total <= 600));
  const night = matchRentals(rentals, {
    ...trip,
    budgetBasis: "night",
    budget: "100",
  });
  assert.ok(night.every((p) => p.quote.average <= 100));
  assert.ok(night.length > 0);
});
test("unavailable and missing-price rental inventory does not leak into matches", () => {
  assert.equal(
    matchRentals([{ ...rentals[0], available: false }], trip).length,
    0,
  );
  assert.equal(
    matchRentals([{ ...rentals[0], nightly: null }], trip).length,
    0,
  );
});
test("scores have an explicit calculation, not hardcoded 98%", () => {
  assert.equal(
    scoreProperty(properties[0], {
      rooms: "1",
      budget: "150000",
      goal: "living",
    }),
    100,
  );
  assert.equal(
    scoreProperty(properties[0], { rooms: "any", budget: "any", goal: "any" }),
    null,
  );
  assert.equal(
    scoreProperty(properties[1], {
      rooms: "2",
      budget: "250000",
      goal: "rental",
    }),
    85,
  );
});
test("unlock signatures isolate profiles, answers and travel periods", () => {
  assert.notEqual(
    selectionSignature("sale", { rooms: "2" }),
    selectionSignature("sale", { rooms: "1" }),
  );
  assert.notEqual(
    selectionSignature("rental", trip),
    selectionSignature("rental", { ...trip, arrival: "2026-11-06" }),
  );
});
test("new funnel orders contact before result, isolates profile/version/preview", () => {
  const events = stepsFor("sale").map(([name], i) => ({
    id: String(i),
    session: "s",
    profile: "sale",
    version: "2.0",
    name,
    at: i,
  }));
  const rows = buildFunnel(
    [
      ...events,
      ...events.map((e) => ({
        ...e,
        id: "old" + e.id,
        session: "old",
        version: "1.0",
      })),
    ],
    { profile: "sale" },
  );
  assert.ok(rows.every((r) => r.count === 1));
  assert.equal(buildFunnel(events, { profile: "rental" })[0].count, 0);
  assert.equal(
    buildFunnel(
      events.map((e) => ({ ...e, preview: true })),
      { profile: "sale" },
    )[0].count,
    0,
  );
});
test("both demo datasets are correctly ordered for their own profiles", () => {
  for (const profile of ["sale", "rental"]) {
    const rows = buildFunnel(fixtureEvents(profile), { profile });
    assert.equal(rows[0].count, 36);
    assert.equal(rows.at(-1).count, 5);
    assert.ok(rows.every((r, i) => !i || r.count <= rows[i - 1].count));
  }
});
test("different profiles and travel intents do not merge leads", () => {
  const first = {
    id: "a",
    session: "s",
    profile: "sale",
    intent: "one",
    objectIds: ["p01"],
    createdAt: 1,
  };
  assert.equal(
    upsertDemoLead([first], { ...first, id: "b", profile: "rental" }).length,
    2,
  );
  assert.equal(
    upsertDemoLead([first], { ...first, id: "c", intent: "two" }).length,
    2,
  );
});
