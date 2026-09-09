import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const QUOTA_PATH = path.join(os.tmpdir(), "mymap-pin-quota.json");
const DAILY_QUOTA_LIMIT = Number(process.env.DAILY_QUOTA_LIMIT || 40000);
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";
const BLOB_NAME = "mymap-pin-quota.json";

function jstDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function quotaKey(date = jstDateKey()) {
  return `mymap-pin-quota:${date}`;
}

function withRemaining(quota) {
  const remaining = Math.max(0, quota.limit - quota.count);
  return {
    ...quota,
    remaining,
    blocked: quota.count >= quota.limit,
  };
}

function kvEnabled() {
  return Boolean(KV_URL && KV_TOKEN);
}

function blobEnabled() {
  return Boolean(BLOB_TOKEN);
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
  if (!response.ok) {
    throw new Error("quota store unavailable");
  }
  const data = await response.json();
  if (data.error) throw new Error(String(data.error));
  return data.result;
}

async function readQuotaFile() {
  const today = jstDateKey();
  try {
    const data = JSON.parse(await fs.readFile(QUOTA_PATH, "utf8"));
    if (data.date === today) {
      return {
        date: today,
        count: Number(data.count) || 0,
        limit: DAILY_QUOTA_LIMIT,
      };
    }
  } catch {
    // new file
  }
  return { date: today, count: 0, limit: DAILY_QUOTA_LIMIT };
}

async function quotaStatusKv() {
  const today = jstDateKey();
  const raw = await kvCommand(["GET", quotaKey(today)]);
  const count = Number(raw) || 0;
  return withRemaining({ date: today, count, limit: DAILY_QUOTA_LIMIT });
}

async function consumeQuotaKv(amount) {
  const today = jstDateKey();
  const key = quotaKey(today);
  let consumed = 0;
  let count = 0;
  for (let i = 0; i < amount; i += 1) {
    count = Number(await kvCommand(["INCR", key])) || 0;
    if (count === 1) {
      await kvCommand(["EXPIRE", key, 60 * 60 * 48]);
    }
    if (count > DAILY_QUOTA_LIMIT) {
      count = Number(await kvCommand(["DECR", key])) || DAILY_QUOTA_LIMIT;
      break;
    }
    consumed += 1;
  }
  return {
    ...withRemaining({ date: today, count, limit: DAILY_QUOTA_LIMIT }),
    consumed,
  };
}

async function blobGet() {
  return fetch(`https://blob.vercel-storage.com/${BLOB_NAME}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${BLOB_TOKEN}`,
      "x-api-version": "7",
    },
  });
}

async function blobPut(body) {
  return fetch(`https://blob.vercel-storage.com/${BLOB_NAME}`, {
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

async function readQuotaBlob() {
  const today = jstDateKey();
  const response = await blobGet();
  if (response.status === 404) {
    return { date: today, count: 0, limit: DAILY_QUOTA_LIMIT };
  }
  if (!response.ok) {
    throw new Error("quota store unavailable");
  }
  const data = await response.json();
  if (data.date === today) {
    return {
      date: today,
      count: Number(data.count) || 0,
      limit: DAILY_QUOTA_LIMIT,
    };
  }
  return { date: today, count: 0, limit: DAILY_QUOTA_LIMIT };
}

async function writeQuotaBlob(quota) {
  const response = await blobPut(JSON.stringify({ date: quota.date, count: quota.count }));
  if (!response.ok) {
    throw new Error("quota store unavailable");
  }
}

async function quotaStatusBlob() {
  return withRemaining(await readQuotaBlob());
}

async function consumeQuotaBlob(amount) {
  const quota = await readQuotaBlob();
  const remaining = Math.max(0, quota.limit - quota.count);
  if (remaining <= 0) {
    return { ...withRemaining(quota), consumed: 0 };
  }
  const consumed = Math.min(amount, remaining);
  quota.count += consumed;
  await writeQuotaBlob(quota);
  return { ...withRemaining(quota), consumed };
}

export async function quotaStatus() {
  try {
    if (kvEnabled()) return quotaStatusKv();
    if (blobEnabled()) return quotaStatusBlob();
    return withRemaining(await readQuotaFile());
  } catch {
    return withRemaining({ date: jstDateKey(), count: 0, limit: DAILY_QUOTA_LIMIT });
  }
}

export async function consumeQuota(amount = 1) {
  const take = Math.max(1, Math.min(5000, Number(amount) || 1));
  try {
    if (kvEnabled()) return consumeQuotaKv(take);
    if (blobEnabled()) return consumeQuotaBlob(take);
    const quota = await readQuotaFile();
    const remaining = Math.max(0, quota.limit - quota.count);
    if (remaining <= 0) {
      return { ...withRemaining(quota), consumed: 0 };
    }
    const consumed = Math.min(take, remaining);
    quota.count += consumed;
    await fs.writeFile(
      QUOTA_PATH,
      JSON.stringify({ date: quota.date, count: quota.count }, null, 2)
    );
    return { ...withRemaining(quota), consumed };
  } catch {
    return {
      ...withRemaining({ date: jstDateKey(), count: 0, limit: DAILY_QUOTA_LIMIT }),
      consumed: take,
    };
  }
}
