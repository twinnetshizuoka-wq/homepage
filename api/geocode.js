import { consumeQuota } from "./_quota.js";

function isInJapan(lat, lng) {
  return lat >= 24 && lat <= 46 && lng >= 122 && lng <= 154;
}

function parseYahooFeature(data) {
  const feature = Array.isArray(data?.Feature) ? data.Feature[0] : data?.Feature;
  const raw = feature?.Geometry?.Coordinates;
  if (!raw) return null;
  const [lng, lat] = String(raw)
    .split(",")
    .map((part) => Number(part.trim()));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInJapan(lat, lng)) {
    return null;
  }
  return {
    lat,
    lng,
    formatted: feature?.Property?.Address || feature?.Name || "",
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  let body = {};
  try {
    const rawBody = req.body;
    body = typeof rawBody === "string" ? JSON.parse(rawBody || "{}") : rawBody || {};
  } catch {
    res.status(400).json({ error: "query required" });
    return;
  }
  const query = String(body.query || "").trim().slice(0, 200);
  if (!query) {
    res.status(400).json({ error: "query required" });
    return;
  }

  const appId = process.env.YAHOO_CLIENT_ID || "";
  if (!appId) {
    res.status(503).json({ error: "yahoo not configured" });
    return;
  }

  const quota = await consumeQuota(1);
  if (!quota.consumed) {
    res.status(429).json({ blocked: true, remaining: 0 });
    return;
  }

  try {
    const url = new URL("https://map.yahooapis.jp/geocode/V1/geoCoder");
    url.searchParams.set("appid", appId);
    url.searchParams.set("query", query);
    url.searchParams.set("output", "json");
    url.searchParams.set("results", "1");
    url.searchParams.set("recursive", "true");
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Referer: "https://www.twin-net.net/",
        "User-Agent": "mymap-pin-app/0.2",
      },
    });
    if (response.status === 204) {
      res.status(200).json({ lat: null, lng: null, formatted: "" });
      return;
    }
    if (!response.ok) {
      res.status(502).json({ error: "yahoo geocode failed" });
      return;
    }
    const data = await response.json();
    res.status(200).json(parseYahooFeature(data) || { lat: null, lng: null, formatted: "" });
  } catch {
    res.status(502).json({ error: "yahoo geocode failed" });
  }
}
