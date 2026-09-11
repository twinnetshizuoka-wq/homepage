const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";
const BLOB_NAME = "mymap-pin-groups.json";

function kvEnabled() {
  return Boolean(KV_URL && KV_TOKEN);
}

function blobEnabled() {
  return Boolean(BLOB_TOKEN);
}

export function bearerToken(req) {
  const header = String(req.headers.authorization || req.headers.Authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

export async function googleEmailFromToken(token) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return "";
  const data = await response.json().catch(() => ({}));
  return String(data.email || "")
    .trim()
    .toLowerCase();
}

function groupsKey(email) {
  return `mymap-pin-groups:${email}`;
}

function blobStoreId() {
  return String(BLOB_TOKEN).split("_")[3] || "";
}

function normalizeRecord(data) {
  return {
    groups: Array.isArray(data?.groups) ? data.groups : [],
    currentGroupId: data?.currentGroupId || null,
    updatedAt: Number(data?.updatedAt) || Date.now(),
  };
}

async function kvCommand(args) {
  const response = await fetch(KV_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!response.ok) throw new Error(`kv ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(String(data.error));
  return data.result;
}

async function readGroupsKv(email) {
  const raw = await kvCommand(["GET", groupsKey(email)]);
  if (!raw) return normalizeRecord({ groups: [] });
  return normalizeRecord(typeof raw === "string" ? JSON.parse(raw) : raw);
}

async function writeGroupsKv(email, record) {
  await kvCommand(["SET", groupsKey(email), JSON.stringify(record)]);
}

async function blobPut(body) {
  const storeId = blobStoreId();
  const headers = {
    Authorization: `Bearer ${BLOB_TOKEN}`,
    "x-api-version": "12",
    "x-vercel-blob-access": "private",
    "x-allow-overwrite": "1",
    "x-add-random-suffix": "0",
    "x-content-type": "application/json",
  };
  if (storeId) headers["x-vercel-blob-store-id"] = storeId;
  const response = await fetch(
    `https://vercel.com/api/blob/?pathname=${encodeURIComponent(BLOB_NAME)}`,
    { method: "PUT", headers, body }
  );
  if (response.ok) return response;
  const legacy = await fetch(`https://blob.vercel-storage.com/${BLOB_NAME}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${BLOB_TOKEN}`,
      "x-api-version": "7",
      "x-vercel-blob-access": "private",
      "x-allow-overwrite": "1",
      "x-add-random-suffix": "0",
      "x-content-type": "application/json",
    },
    body,
  });
  return legacy.ok ? legacy : response;
}

async function blobGet() {
  const storeId = blobStoreId();
  const urls = [];
  if (storeId) {
    urls.push(
      `https://${storeId}.private.blob.vercel-storage.com/${BLOB_NAME}?cache=0`
    );
    urls.push(`https://${storeId}.public.blob.vercel-storage.com/${BLOB_NAME}`);
  }
  urls.push(`https://blob.vercel-storage.com/${BLOB_NAME}`);
  let last = null;
  for (const url of urls) {
    last = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${BLOB_TOKEN}`,
        "x-api-version": "12",
      },
    });
    if (last.ok || last.status === 404) return last;
  }
  return last;
}

async function readAllGroupsBlob() {
  const response = await blobGet();
  if (!response || response.status === 404) return {};
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`blob get ${response.status} ${detail.slice(0, 120)}`);
  }
  const data = await response.json().catch(() => ({}));
  return data && typeof data === "object" ? data : {};
}

async function writeAllGroupsBlob(store) {
  const response = await blobPut(JSON.stringify(store));
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`blob put ${response.status} ${detail.slice(0, 120)}`);
  }
}

async function readGroupsBlob(email) {
  const store = await readAllGroupsBlob();
  return normalizeRecord(store[email]);
}

async function writeGroupsBlob(email, record) {
  const store = await readAllGroupsBlob();
  store[email] = record;
  await writeAllGroupsBlob(store);
}

export function groupsStoreReady() {
  return kvEnabled() || blobEnabled();
}

export async function readGroups(email) {
  const errors = [];
  if (blobEnabled()) {
    try {
      return await readGroupsBlob(email);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "blob read failed");
    }
  }
  if (kvEnabled()) {
    try {
      return await readGroupsKv(email);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "kv read failed");
    }
  }
  throw new Error(errors.join(" / ") || "groups store unavailable");
}

export async function writeGroups(email, input) {
  const record = normalizeRecord(input);
  const errors = [];
  if (blobEnabled()) {
    try {
      await writeGroupsBlob(email, record);
      return record;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "blob write failed");
    }
  }
  if (kvEnabled()) {
    try {
      await writeGroupsKv(email, record);
      return record;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "kv write failed");
    }
  }
  throw new Error(errors.join(" / ") || "groups store unavailable");
}
