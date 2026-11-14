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
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function googleQuotaExceeded(status, httpStatus) {
  if (httpStatus === 429) return true;
  const code = String(status || "").toUpperCase();
  return ["OVER_QUERY_LIMIT", "OVER_DAILY_LIMIT", "RESOURCE_EXHAUSTED"].includes(code);
}

function coordsFromLatLng(lat, lng, formatted, name) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !isInJapan(latitude, longitude)) {
    return null;
  }
  return {
    lat: latitude,
    lng: longitude,
    formatted: formatted || "",
    name: name || "",
  };
}

function googlePlaceCandidates(places) {
  return (Array.isArray(places) ? places : []).map((place) => ({
    Name: place?.displayName?.text || "",
    Property: { Address: place?.formattedAddress || place?.shortFormattedAddress || "" },
    Geometry: {
      Coordinates: `${place?.location?.longitude},${place?.location?.latitude}`,
    },
  }));
}

function isPreciseGoogle(result) {
  const types = Array.isArray(result?.types) ? result.types : [];
  if (
    types.some((type) =>
      ["street_address", "premise", "subpremise", "establishment", "point_of_interest", "route"].includes(type)
    )
  ) {
    return true;
  }
  const locationType = String(result?.geometry?.location_type || "");
  return locationType === "ROOFTOP" || locationType === "RANGE_INTERPOLATED";
}

async function searchGooglePlaces(apiKey, query) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.shortFormattedAddress,places.location",
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "ja",
      regionCode: "JP",
      maxResultCount: 10,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (googleQuotaExceeded(data?.error?.status, response.status)) {
    throw new Error("google quota");
  }
  if (!response.ok) return null;
  return pickNamedPlace(googlePlaceCandidates(data?.places), query);
}

async function geocodeAddressGoogle(apiKey, query) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("language", "ja");
  url.searchParams.set("region", "jp");
  url.searchParams.set("components", "country:JP");
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (googleQuotaExceeded(data.status, response.status)) {
    throw new Error("google quota");
  }
  if (data.status !== "OK" || !Array.isArray(data.results) || !data.results.length) {
    return null;
  }
  const parsed = parsePlaceQuery(query);
  const match =
    data.results.find((result) => {
      const address = result.formatted_address || "";
      const name = result.address_components?.map((part) => part.long_name).join(" ") || "";
      if (parsed.city && !normalizeQuery(address).includes(normalizeQuery(parsed.city))) {
        return false;
      }
      if (parsed.name && !nameMatches(`${result.formatted_address} ${name}`, parsed.name)) {
        return false;
      }
      return true;
    }) || (parsed.name ? null : data.results[0]);
  if (!match) return null;
  const found = coordsFromLatLng(
    match.geometry?.location?.lat,
    match.geometry?.location?.lng,
    match.formatted_address,
    parsed.name || match.formatted_address
  );
  if (!found) return null;
  found.precise = isPreciseGoogle(match);
  return found;
}

async function locateGoogle(apiKey, query, mode) {
  const wantPlace = mode === "place" || mode === "auto";
  if (wantPlace) {
    try {
      const place = await searchGooglePlaces(apiKey, query);
      if (place) return place;
    } catch {
      // Places quota or error; try Geocoding next
    }
  }
  const geo = await geocodeAddressGoogle(apiKey, query);
  if (!geo) return null;
  if (mode === "place" && geo.precise === false) return null;
  return geo;
}

async function locate(query, mode) {
  const googleKey = process.env.GOOGLE_MAPS_API_KEY || "";
  const appId = process.env.YAHOO_CLIENT_ID || "";
  if (googleKey) {
    try {
      const found = await locateGoogle(googleKey, query, mode);
      if (found) return { ...found, provider: "google" };
    } catch {
      // Yahoo next
    }
  }
  if (appId) {
    const found = await locateYahoo(appId, query, mode);
    if (found) return { ...found, provider: "yahoo" };
  }
  return null;
}

function parsePlaceQuery(query) {
  const raw = String(query || "").trim();
  const compact = raw.replace(/\s+/g, "");
  const prefecture = (compact.match(/(.{1,4}[都道府県])/) || [])[1] || "";
  const afterPref = prefecture ? compact.slice(prefecture.length) : compact;
  const city = (afterPref.match(/(.+?[市区町村])/) || [])[1] || "";
  const afterCity = city ? afterPref.slice(city.length) : afterPref;
  const spaced = raw.split(/\s+/).filter(Boolean);
  const nameFromSpaced = spaced
    .filter((token) => !/[都道府県市区町村]$/.test(token) && token !== `${prefecture}${city}`)
    .pop();
  const name = nameFromSpaced || afterCity;
  return { raw, prefecture, city, name };
}

function inSameCity(feature, city) {
  if (!city) return true;
  const address = normalizeQuery(feature?.Property?.Address || "");
  const hint = normalizeQuery(city);
  if (!hint) return true;
  if (!address) return false;
  return address.includes(hint);
}

function nameMatches(featureName, placeName) {
  const name = normalizeQuery(featureName).replace(/\s+/g, "");
  const token = normalizeQuery(placeName).replace(/\s+/g, "");
  if (!name || !token) return false;
  if (name.includes(token)) return true;
  return token.length >= 6 && name.length >= 6 && token.includes(name);
}

function featurePlaceText(feature) {
  return [
    feature?.Name,
    feature?.Property?.Address,
    feature?.Property?.Building?.Name,
    feature?.Property?.Query,
  ]
    .filter(Boolean)
    .join(" ");
}

function pickNamedPlace(features, query) {
  const parsed = parsePlaceQuery(query);
  const placeName = parsed.name;
  if (!placeName) return null;
  let best = null;
  let bestScore = 0;
  features.forEach((feature) => {
    if (!inSameCity(feature, parsed.city)) return;
    const blob = featurePlaceText(feature);
    if (!nameMatches(blob, placeName) && !nameMatches(feature?.Name, placeName)) return;
    const name = normalizeQuery(feature?.Name);
    let score = 10;
    if (name === normalizeQuery(placeName)) score += 5;
    if (nameMatches(feature?.Name, placeName)) score += 4;
    if (parsed.city && inSameCity(feature, parsed.city)) score += 3;
    if (score > bestScore) {
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
  const parsed = parsePlaceQuery(query);
  const url = new URL("https://map.yahooapis.jp/search/local/V1/localSearch");
  url.searchParams.set("appid", appId);
  url.searchParams.set("query", parsed.name || query);
  url.searchParams.set("output", "json");
  url.searchParams.set("results", "20");
  url.searchParams.set("sort", "match");
  const data = await yahooJson(url);
  return data ? pickNamedPlace(featureList(data), query) : null;
}

async function searchContents(appId, query) {
  const parsed = parsePlaceQuery(query);
  const queries = [...new Set([
    parsed.name,
    parsed.city && parsed.name ? `${parsed.city} ${parsed.name}` : "",
    parsed.city && parsed.name ? `${parsed.city}${parsed.name}` : "",
    query,
  ].filter(Boolean))];
  for (const q of queries) {
    for (const category of ["landmark", "address"]) {
      const url = new URL("https://map.yahooapis.jp/geocode/cont/V1/contentsGeoCoder");
      url.searchParams.set("appid", appId);
      url.searchParams.set("query", q);
      url.searchParams.set("category", category);
      url.searchParams.set("output", "json");
      url.searchParams.set("results", "10");
      try {
        const data = await yahooJson(url);
        const found = data ? pickNamedPlace(featureList(data), query) : null;
        if (found) return found;
      } catch {
        // try the next query
      }
    }
  }
  return null;
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

  const googleKey = process.env.GOOGLE_MAPS_API_KEY || "";
  const appId = process.env.YAHOO_CLIENT_ID || "";
  if (!googleKey && !appId) {
    res.status(503).json({ error: "geocoder not configured" });
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
    const found = await locate(query, mode);
    res.status(200).json({
      ...(found || { lat: null, lng: null, formatted: "", provider: "" }),
      quota,
    });
  } catch {
    res.status(502).json({ error: "geocode failed", quota });
  }
}
