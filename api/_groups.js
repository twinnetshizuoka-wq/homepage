const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";

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

function blobName(email) {
  return `mymap-pin-groups/${email.replace(/[^a-z0-9._-]+/gi, "_")}.json`;
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
  if (!response.ok) throw new Error("groups store unavailable");
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

async function blobGet(email) {
  return fetch(`https://blob.vercel-storage.com/${blobName(email)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${BLOB_TOKEN}`,
      "x-api-version": "7",
    },
  });
}

async function blobPut(email, body) {
  return fetch(`https://blob.vercel-storage.com/${blobName(email)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${BLOB_TOKEN}`,
      "x-api-version": "7",
      "x-content-type": "application/json",
      "x-add-random-suffix": "0",
      "x-allow-overwrite": "true",
    },
    body,
  });
}

async function readGroupsBlob(email) {
  const response = await blobGet(email);
  if (response.status === 404) return normalizeRecord({ groups: [] });
  if (!response.ok) throw new Error("groups store unavailable");
  return normalizeRecord(await response.json());
}

async function writeGroupsBlob(email, record) {
  const response = await blobPut(email, JSON.stringify(record));
  if (!response.ok) throw new Error("groups store unavailable");
}

export function groupsStoreReady() {
  return kvEnabled() || blobEnabled();
}

export async function readGroups(email) {
  if (kvEnabled()) return readGroupsKv(email);
  if (blobEnabled()) return readGroupsBlob(email);
  throw new Error("groups store unavailable");
}

export async function writeGroups(email, input) {
  const record = normalizeRecord(input);
  if (kvEnabled()) {
    await writeGroupsKv(email, record);
    return record;
  }
  if (blobEnabled()) {
    await writeGroupsBlob(email, record);
    return record;
  }
  throw new Error("groups store unavailable");
}
