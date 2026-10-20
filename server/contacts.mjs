import { validatePhone } from "../src/phone.mjs";

export function contactConfig(env = process.env) {
  if (env.CONTACT_LOOKUP_MODE !== "waha") return { enabled: false };
  try {
    const url = new URL(env.WAHA_BASE_URL);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !env.WAHA_API_KEY ||
      !/^[\w-]{1,80}$/.test(env.WAHA_SESSION || "default")
    )
      return { enabled: false };
    return {
      enabled: true,
      url,
      key: env.WAHA_API_KEY,
      session: env.WAHA_SESSION || "default",
      timeout: 5000,
    };
  } catch {
    return { enabled: false };
  }
}

export async function checkWhatsApp(phone, config, fetcher = fetch) {
  if (!config.enabled)
    return { status: "unknown", reason: "not_configured", provider: null };
  const url = new URL(
    "api/contacts/check-exists",
    `${config.url.href.replace(/\/$/, "")}/`,
  );
  url.searchParams.set("phone", phone.slice(1));
  url.searchParams.set("session", config.session);
  try {
    const response = await fetcher(url, {
      headers: { "X-Api-Key": config.key, Accept: "application/json" },
      signal: AbortSignal.timeout(config.timeout || 5000),
      redirect: "error",
    });
    if (!response.ok)
      return {
        status: "error",
        reason: "provider_unavailable",
        provider: "waha",
      };
    const data = await response.json();
    if (typeof data?.numberExists !== "boolean")
      return {
        status: "error",
        reason: "invalid_provider_response",
        provider: "waha",
      };
    // chatId/pn may contain identifiers; never return them to demo storage or analytics.
    return {
      status: data.numberExists ? "yes" : "no",
      provider: "waha",
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "error",
      reason: ["TimeoutError", "AbortError"].includes(error.name)
        ? "timeout"
        : "provider_unavailable",
      provider: "waha",
    };
  }
}

export function createContactMiddleware({
  config = contactConfig(),
  fetcher = fetch,
  maxPerMinute = 10,
  now = Date.now,
} = {}) {
  const counters = new Map();
  let active = 0;
  const reply = (res, status, data) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(JSON.stringify(data));
  };
  return async (req, res, next) => {
    const path = req.url?.split("?")[0];
    if (!["/api/contacts/capabilities", "/api/contacts/check"].includes(path))
      return next();
    if (path === "/api/contacts/capabilities" && req.method === "GET")
      return reply(res, 200, {
        whatsappEnabled: config.enabled,
        provider: config.enabled ? "waha" : null,
      });
    if (path !== "/api/contacts/check" || req.method !== "POST")
      return reply(res, 405, { error: "method_not_allowed" });
    try {
      const origin = new URL(req.headers.origin);
      if (
        origin.host !== req.headers.host ||
        !["http:", "https:"].includes(origin.protocol) ||
        req.headers["sec-fetch-site"] === "cross-site"
      )
        return reply(res, 403, { error: "origin_not_allowed" });
    } catch {
      return reply(res, 403, { error: "origin_required" });
    }
    if (!req.headers["content-type"]?.startsWith("application/json"))
      return reply(res, 415, { error: "json_required" });
    const time = now();
    for (const [key, entry] of counters)
      if (time - entry.since >= 60000) counters.delete(key);
    const key = req.socket.remoteAddress || "local";
    const entry = counters.get(key) || { since: time, count: 0 };
    const total = [...counters.values()].reduce(
      (sum, item) => sum + item.count,
      0,
    );
    if (
      entry.count >= maxPerMinute ||
      total >= 30 ||
      counters.size > 1024 ||
      active >= 2
    )
      return reply(res, 429, { error: "rate_limited" });
    entry.count++;
    counters.set(key, entry);
    active++;
    const bodyTimeout = setTimeout(() => req.destroy(), 8000);
    bodyTimeout.unref();
    try {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 2048)
          return reply(res, 413, { error: "body_too_large" });
      }
      clearTimeout(bodyTimeout);
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        return reply(res, 400, { error: "invalid_json" });
      }
      const phone = validatePhone(data?.phone);
      if (!phone.valid)
        return reply(res, 422, {
          phone,
          whatsapp: { status: "unknown", reason: "invalid_phone" },
        });
      const summary = { valid: true, country: phone.country, type: phone.type };
      if (
        data.lookupWhatsApp === true &&
        config.enabled &&
        data.lookupConsent !== true
      )
        return reply(res, 412, {
          error: "lookup_consent_required",
          phone: summary,
          whatsapp: { status: "unknown", reason: "consent_required" },
        });
      const whatsapp =
        data.lookupWhatsApp === true
          ? await checkWhatsApp(phone.normalized, config, fetcher)
          : { status: "unknown", reason: "not_requested", provider: null };
      return reply(res, 200, { phone: summary, whatsapp });
    } catch {
      if (!res.writableEnded) reply(res, 400, { error: "request_failed" });
    } finally {
      active--;
      clearTimeout(bodyTimeout);
    }
  };
}
