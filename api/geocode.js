import { consumeQuota } from "./_quota.js";

const YAHOO_HEADERS = {
  Accept: "application/json",
  Referer: "https://www.twin-net.net/",
  "User-Agent": "mymap-pin-app/0.2",
};

function isInJapan(lat, lng) {
  return lat >= 24 && lat <= 46 && lng >= 122 && lng <= 154;
}

function featureList(data) {
  if (!data?.Feature) return [];
  return Array.isArray(data.Feature) ? data.Feature : [data.Feature];
}

function coordsFromFeature(feature) {
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
    name: feature?.Name || "",
  };
}

function normalizeQuery(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function pickNamedPlace(features, query) {
  const q = normalizeQuery(query);
  const tokens = q.split(" ").filter((token) => token.length >= 2);
  const nameToken = tokens[tokens.length - 1] || "";
  if (!nameToken) return null;
  let best = null;
  let bestScore = 0;
  features.forEach((feature) => {
    const name = normalizeQuery(feature?.Name);
    if (!name) return;
    let score = 0;
    if (name.includes(nameToken) || nameToken.includes(name)) score += 10;
    tokens.forEach((token) => {
      if (name.includes(token)) score += 1;
    });
    if (score >= 10 && score > bestScore) {
      best = feature;
      bestScore = score;
    }
  });
  return best ? coordsFromFeature(best) : null;
}

function isPreciseAddress(feature) {
  const n = Number(feature?.Property?.AddressMatchingLevel);
  if (Number.isFinite(n) && n >= 3) return true;
  const elements = feature?.Property?.AddressElement;
  const list = Array.isArray(elements) ? elements : elements ? [elements] : [];
  if (list.length >= 3) return true;
  return list.some((item) => {
    const level = String(item?.Level || item?.level || "").toLowerCase();
    return ["oaza", "aza", "detail1", "detail2", "town", "chome"].includes(level);
  });
}

async function yahooJson(url) {
  const response = await fetch(url, { headers: YAHOO_HEADERS });
  if (response.status === 204) return null;
  if (!response.ok) throw new Error(`yahoo ${response.status}`);
  return response.json();
}

async function searchLocal(appId, query) {
  const url = new URL("https://map.yahooapis.jp/search/local/V1/localSearch");
  url.searchParams.set("appid", appId);
  url.searchParams.set("query", query);
  url.searchParams.set("output", "json");
  url.searchParams.set("results", "5");
  url.searchParams.set("sort", "match");
  const data = await yahooJson(url);
  return data ? pickNamedPlace(featureList(data), query) : null;
}

async function searchContents(appId, query) {
  const url = new URL("https://map.yahooapis.jp/geocode/cont/V1/contentsGeoCoder");
  url.searchParams.set("appid", appId);
  url.searchParams.set("query", query);
  url.searchParams.set("category", "landmark");
  url.searchParams.set("output", "json");
  url.searchParams.set("results", "5");
  const data = await yahooJson(url);
  return data ? pickNamedPlace(featureList(data), query) : null;
}

async function geocodeAddressYahoo(appId, query) {
  const url = new URL("https://map.yahooapis.jp/geocode/V1/geoCoder");
  url.searchParams.set("appid", appId);
  url.searchParams.set("query", query);
  url.searchParams.set("output", "json");
  url.searchParams.set("results", "1");
  url.searchParams.set("recursive", "true");
  const data = await yahooJson(url);
  const feature = featureList(data)[0];
  const found = coordsFromFeature(feature);
  if (!found) return null;
  found.precise = isPreciseAddress(feature);
  return found;
}

async function locateYahoo(appId, query, mode) {
  const wantPlace = mode === "place" || mode === "auto";
  if (wantPlace) {
    try {
      const local = await searchLocal(appId, query);
      if (local) return local;
    } catch {
      // fall through
    }
    try {
      const contents = await searchContents(appId, query);
      if (contents) return contents;
    } catch {
      // fall through
    }
  }
  const geo = await geocodeAddressYahoo(appId, query);
  if (!geo) return null;
  if (mode === "place" && geo.precise === false) return null;
  return geo;
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
  const mode = ["place", "address", "auto"].includes(body.mode) ? body.mode : "auto";
  if (!query) {
    res.status(400).json({ error: "query required" });
    return;
  }

  const appId = process.env.YAHOO_CLIENT_ID || "";
  if (!appId) {
    res.status(503).json({ error: "yahoo not configured" });
    return;
  }

  let quota;
  try {
    quota = await consumeQuota(1);
  } catch {
    quota = {
      date: new Date().toISOString().slice(0, 10),
      count: 0,
      limit: 20000,
      remaining: 20000,
      blocked: false,
      consumed: 1,
    };
  }
  if (!quota.consumed) {
    res.status(429).json({
      blocked: true,
      remaining: 0,
      count: quota.count,
      limit: quota.limit,
      quota,
    });
    return;
  }

  try {
    const found = await locateYahoo(appId, query, mode);
    res.status(200).json({
      ...(found || { lat: null, lng: null, formatted: "" }),
      quota,
    });
  } catch {
    res.status(502).json({ error: "yahoo geocode failed", quota });
  }
}
