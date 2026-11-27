// Minimal, allowlisted Kalshi public-data proxy for the GitHub Pages analyzer.
import http from "node:http";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const KALSHI = "https://external-api.kalshi.com/trade-api/v2";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://anthonysmiller1974-arch.github.io";
const MAX_BODYLESS_PATH = /^\/(markets(?:\/[^/]+)?|markets\/candlesticks|historical\/markets\/[^/]+\/candlesticks)$/;

function send(res, status, data, origin) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || "";
  if (req.method === "OPTIONS") {
    if (origin !== ALLOWED_ORIGIN) return send(res, 403, { error: "Origin not allowed" }, ALLOWED_ORIGIN);
    res.writeHead(204, {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
      "Vary": "Origin"
    });
    return res.end();
  }
  if (origin && origin !== ALLOWED_ORIGIN) return send(res, 403, { error: "Origin not allowed" }, ALLOWED_ORIGIN);
  if (req.method !== "GET") return send(res, 405, { error: "GET only" }, ALLOWED_ORIGIN);

  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/health") return send(res, 200, { ok: true, service: "kalshi-public-data-proxy" }, ALLOWED_ORIGIN);
  if (!MAX_BODYLESS_PATH.test(url.pathname)) return send(res, 404, { error: "Route not allowed" }, ALLOWED_ORIGIN);

  // Only the BTC 15-minute series and its public market detail/candle endpoints are exposed.
  if (url.pathname === "/markets" && url.searchParams.get("series_ticker") !== "KXBTC15M") {
    return send(res, 400, { error: "Only KXBTC15M is enabled" }, ALLOWED_ORIGIN);
  }
  const upstreamUrl = new URL(KALSHI + url.pathname);
  for (const [key, value] of url.searchParams) upstreamUrl.searchParams.append(key, value);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    const body = await upstream.text();
    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Vary": "Origin",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(body);
  } catch (error) {
    send(res, 502, { error: "Kalshi upstream request failed", detail: error.name === "AbortError" ? "Upstream timeout" : "Upstream unavailable" }, ALLOWED_ORIGIN);
  } finally {
    clearTimeout(timer);
  }
});

server.listen(PORT, HOST, () => {
  console.log("Kalshi proxy listening on " + HOST + ":" + PORT);
});
