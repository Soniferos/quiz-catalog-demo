const googleQuoteUrl = (pair) =>
  `https://www.google.com/finance/quote/${pair}?hl=en`;

async function readGoogleRate(pair) {
  const response = await fetch(googleQuoteUrl(pair), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; QuizCatalogDemo/1.0)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Google Finance returned ${response.status}`);
  const html = await response.text();
  const match = html.match(
    /<div class="N6SYTe"><span jsname="Pdsbrc"[^>]*><span>([0-9][0-9,.]*)<\/span>/,
  );
  const rate = match ? Number(match[1].replaceAll(",", "")) : NaN;
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Google Finance rate was not found");
  return rate;
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "method_not_allowed" });
  }
  try {
    const [thb, rub] = await Promise.all([
      readGoogleRate("USD-THB"),
      readGoogleRate("USD-RUB"),
    ]);
    response.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=300");
    return response.status(200).json({
      source: "Google Finance",
      updatedAt: new Date().toISOString(),
      rates: { USD: 1, THB: thb, RUB: rub },
    });
  } catch {
    response.setHeader("Cache-Control", "no-store");
    return response.status(503).json({ error: "rates_unavailable" });
  }
}
