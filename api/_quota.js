import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const QUOTA_PATH = path.join(os.tmpdir(), "mymap-pin-quota.json");
const DAILY_QUOTA_LIMIT = Number(process.env.DAILY_QUOTA_LIMIT || 40000);

function jstDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function readQuota() {
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

function withRemaining(quota) {
  const remaining = Math.max(0, quota.limit - quota.count);
  return {
    ...quota,
    remaining,
    blocked: quota.count >= quota.limit,
  };
}

export async function quotaStatus() {
  return withRemaining(await readQuota());
}

export async function consumeQuota(amount = 1) {
  const take = Math.max(1, Math.min(5000, Number(amount) || 1));
  const quota = await readQuota();
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
}
