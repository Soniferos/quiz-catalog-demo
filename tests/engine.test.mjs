import test from "node:test";
import assert from "node:assert/strict";
import { properties, emptyAnswers, districts } from "../src/config.mjs";
import {
  matchProperties,
  matchReasons,
  validatePhone,
  buildFunnel,
  fixtureEvents,
  upsertDemoLead,
} from "../src/engine.mjs";

test("all available fixtures match an unrestricted search", () =>
  assert.equal(matchProperties(properties, emptyAnswers).length, 10));
test("strict budget and room count, no near matches passed off as exact", () => {
  const results = matchProperties(properties, {
    budget: "250000",
    rooms: "2",
    district: "bangtao",
    handover: "2027",
  });
  assert.deepEqual(
    results.map((p) => p.id),
    ["p09", "p02"],
  );
});
test("impossible combination produces an empty result", () =>
  assert.equal(
    matchProperties(properties, { budget: "150000", rooms: "3" }).length,
    0,
  ));
test("unavailable and unknown price are excluded", () =>
  assert.equal(
    matchProperties(
      [
        { ...properties[0], available: false },
        { ...properties[0], price: null },
      ],
      {},
    ).length,
    0,
  ));
test("ready filter excludes future handovers", () =>
  assert.ok(
    matchProperties(properties, { handover: "ready" }).every((p) => p.ready),
  ));
test("goal sorts but does not invent a hard eligibility rule", () => {
  const all = matchProperties(properties, { goal: "living" });
  assert.equal(all.length, 10);
  assert.ok(all[0].goals.includes("living"));
});
test("reasons are factual, not synthetic percentages", () =>
  assert.ok(
    matchReasons(
      properties[0],
      { budget: "150000", rooms: "1" },
      districts,
    ).includes("В вашем бюджете"),
  ));
test("valid reserved example number normalizes", () =>
  assert.equal(validatePhone("+1 202 555 0123").normalized, "+12025550123"));
test("garbage phone is rejected", () =>
  assert.equal(validatePhone("12345").valid, false));
test("funnel deduplicates events and ignores preview", () => {
  const base = { session: "a", at: 1, dataset: "local" };
  const events = [
    { ...base, id: "1", name: "visit" },
    { ...base, id: "1", name: "visit" },
    { ...base, id: "2", name: "start", at: 2 },
    { ...base, session: "preview", id: "3", name: "visit", preview: true },
  ];
  assert.deepEqual(
    buildFunnel(events)
      .slice(0, 2)
      .map((r) => r.count),
    [1, 1],
  );
});
test("direct question and out-of-order steps cannot inflate funnel", () => {
  const result = buildFunnel([
    { id: "1", session: "x", at: 1, name: "question_budget" },
  ]);
  assert.ok(result.every((r) => r.count === 0));
  assert.equal(result[0].totalRate, null);
});
test("source and device filters preserve coherent samples", () => {
  const rows = buildFunnel(fixtureEvents(), {
    dataset: "sample",
    source: "yandex",
    device: "mobile",
  });
  assert.ok(rows[0].count > 0);
  assert.ok(rows.every((r, i) => !i || r.count <= rows[i - 1].count));
});
test("sample data is explicitly separated from local visits", () =>
  assert.equal(buildFunnel(fixtureEvents(), { dataset: "local" })[0].count, 0));
test("repeat inquiry updates existing lead and keeps its ID and stage", () => {
  const first = {
    id: "a",
    session: "s",
    objectIds: ["p01"],
    createdAt: 1,
    stage: "qualified",
  };
  const result = upsertDemoLead([first], {
    id: "b",
    session: "s",
    objectIds: ["p02"],
    createdAt: 2,
    stage: "new",
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "a");
  assert.equal(result[0].stage, "qualified");
  assert.deepEqual(result[0].objectIds, ["p01", "p02"]);
});
