import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { validatePhone } from "../src/phone.mjs";
import { upsertDemoLead } from "../src/engine.mjs";
import {
  contactConfig,
  checkWhatsApp,
  createContactMiddleware,
} from "../server/contacts.mjs";

const number = "+1 202 555 0123";
test("later object requests preserve contact check status without storing the number", () => {
  const first = {
    id: "one",
    session: "s",
    profile: "sale",
    intent: "i",
    objectIds: ["p01"],
    stage: "new",
    createdAt: 1,
    contactChecks: { phoneStatus: "valid", whatsappStatus: "no" },
  };
  const [updated] = upsertDemoLead([first], {
    session: "s",
    profile: "sale",
    intent: "i",
    objectIds: ["p02"],
  });
  assert.equal(updated.contactChecks.whatsappStatus, "no");
  assert.deepEqual(updated.objectIds, ["p01", "p02"]);
});
const config = contactConfig({
  CONTACT_LOOKUP_MODE: "waha",
  WAHA_BASE_URL: "http://127.0.0.1:3000",
  WAHA_API_KEY: "test-secret",
});
async function api(t, options = {}) {
  const middleware = createContactMiddleware(options);
  const server = createServer((req, res) =>
    middleware(req, res, () => {
      res.writeHead(404);
      res.end();
    }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    post: (data, headers = {}) =>
      fetch(`${base}/api/contacts/check`, {
        method: "POST",
        headers: {
          Origin: base,
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(data),
      }),
  };
}

test("phone parser is strict, international and does not extract numbers from prose", () => {
  assert.equal(validatePhone(number).normalized, "+12025550123");
  for (const value of [
    "call +1 202 555 0123",
    "+1 202 555 0123 ext 10",
    "2025550123",
    "+1 2025550123 garbage",
    null,
    7777777,
  ])
    assert.equal(validatePhone(value).valid, false);
});
test("repeated seven, national placeholders and full sequences are rejected", () => {
  for (const value of [
    "7777777",
    "+7 7777777777",
    "+7 9999999999",
    "+7 9191919191",
    "+7 9876543210",
  ])
    assert.equal(validatePhone(value).valid, false, value);
  assert.equal(validatePhone("+7 7777777777").code, "placeholder");
});
test("ordinary mixed numbers and international punctuation remain usable", () => {
  assert.equal(validatePhone("+1 (202) 555-0123").valid, true);
  assert.equal(validatePhone("+7 999 123-45-67").valid, true);
});
test("WAHA is opt-in, secrets stay server-side and insecure remote URL is rejected", () => {
  assert.equal(contactConfig({}).enabled, false);
  assert.equal(config.enabled, true);
  assert.equal(
    contactConfig({
      CONTACT_LOOKUP_MODE: "waha",
      WAHA_BASE_URL: "http://remote.example",
      WAHA_API_KEY: "key",
    }).enabled,
    false,
  );
  assert.equal(
    contactConfig({
      CONTACT_LOOKUP_MODE: "waha",
      WAHA_BASE_URL: "https://u:p@example.com",
      WAHA_API_KEY: "key",
    }).enabled,
    false,
  );
});
test("WAHA wire contract uses check-exists with canonical digits and key header", async () => {
  let captured;
  const result = await checkWhatsApp(
    "+12025550123",
    config,
    async (url, options) => {
      captured = { url, options };
      return Response.json({
        numberExists: true,
        chatId: "private@lid",
        pn: "private@c.us",
      });
    },
  );
  assert.equal(captured.url.pathname, "/api/contacts/check-exists");
  assert.equal(captured.url.searchParams.get("phone"), "12025550123");
  assert.equal(captured.url.searchParams.get("session"), "default");
  assert.equal(captured.options.headers["X-Api-Key"], "test-secret");
  assert.equal(captured.options.redirect, "error");
  assert.equal(result.status, "yes");
  assert.ok(!JSON.stringify(result).includes("private"));
});
test("not found, malformed reply and provider errors are different outcomes", async () => {
  assert.equal(
    (
      await checkWhatsApp("+12025550123", config, async () =>
        Response.json({ numberExists: false }),
      )
    ).status,
    "no",
  );
  for (const reply of [{}, { numberExists: "false" }, { exists: true }])
    assert.equal(
      (
        await checkWhatsApp("+12025550123", config, async () =>
          Response.json(reply),
        )
      ).status,
      "error",
    );
  assert.equal(
    (
      await checkWhatsApp(
        "+12025550123",
        config,
        async () => new Response("offline", { status: 503 }),
      )
    ).status,
    "error",
  );
});
test("timeout does not become WhatsApp absent; disabled makes no provider call", async () => {
  const timeout = await checkWhatsApp("+12025550123", config, async () => {
    throw new DOMException("timeout", "TimeoutError");
  });
  assert.equal(timeout.status, "error");
  assert.equal(timeout.reason, "timeout");
  const disabled = await checkWhatsApp(
    "+12025550123",
    { enabled: false },
    () => {
      throw Error("must not run");
    },
  );
  assert.equal(disabled.status, "unknown");
});
test("HTTP capabilities disclose no secret or infrastructure URL", async (t) => {
  const { base } = await api(t, { config });
  const response = await fetch(`${base}/api/contacts/capabilities`);
  assert.deepEqual(await response.json(), {
    whatsappEnabled: true,
    provider: "waha",
  });
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("HTTP revalidates client input and never queries garbage numbers", async (t) => {
  let calls = 0;
  const { post } = await api(t, {
    config,
    fetcher: async () => {
      calls++;
      return Response.json({ numberExists: true });
    },
  });
  const response = await post({
    phone: "+7 7777777777",
    lookupWhatsApp: true,
    lookupConsent: true,
  });
  assert.equal(response.status, 422);
  assert.equal(calls, 0);
  assert.equal((await response.json()).phone.code, "placeholder");
});
test("HTTP requires consent before external lookup and returns only anonymous status", async (t) => {
  let calls = 0;
  const { post } = await api(t, {
    config,
    fetcher: async () => {
      calls++;
      return Response.json({ numberExists: true, chatId: "secret-contact" });
    },
  });
  assert.equal(
    (await post({ phone: number, lookupWhatsApp: true })).status,
    412,
  );
  assert.equal(calls, 0);
  const response = await post({
    phone: number,
    lookupWhatsApp: true,
    lookupConsent: true,
  });
  const text = await response.text();
  assert.equal(calls, 1);
  assert.equal(JSON.parse(text).whatsapp.status, "yes");
  for (const privateValue of ["2025550123", "secret-contact", "test-secret"])
    assert.ok(!text.includes(privateValue));
});
test("non-WhatsApp channel and unconfigured service never invoke WAHA", async (t) => {
  const { post } = await api(t, {
    config: { enabled: false },
    fetcher: () => {
      throw Error("unexpected");
    },
  });
  assert.equal(
    (await (await post({ phone: number, lookupWhatsApp: true })).json())
      .whatsapp.reason,
    "not_configured",
  );
  assert.equal(
    (await (await post({ phone: number, lookupWhatsApp: false })).json())
      .whatsapp.reason,
    "not_requested",
  );
});
test("HTTP restricts origins, content type, body size and attempt rate", async (t) => {
  const { post, base } = await api(t, {
    config: { enabled: false },
    maxPerMinute: 2,
  });
  assert.equal(
    (await post({ phone: number }, { Origin: "https://other.example" })).status,
    403,
  );
  assert.equal(
    (await post({ phone: number }, { "Content-Type": "text/plain" })).status,
    415,
  );
  assert.equal((await post({ phone: "x".repeat(2200) })).status, 413);
  assert.equal((await post({ phone: number })).status, 200);
  assert.equal((await post({ phone: number })).status, 429);
  assert.equal((await fetch(`${base}/api/contacts/check`)).status, 405);
});
