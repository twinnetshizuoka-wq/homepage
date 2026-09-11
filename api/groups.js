import {
  bearerToken,
  googleEmailFromToken,
  groupsStoreReady,
  readGroups,
  writeGroups,
} from "./_groups.js";

function parseBody(req) {
  const raw = req.body;
  if (!raw) return {};
  if (typeof raw === "string") return JSON.parse(raw || "{}");
  return raw;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Googleログインが必要です" });
    return;
  }
  const email = await googleEmailFromToken(token);
  if (!email) {
    res.status(401).json({ error: "Googleログインの有効期限が切れています。もう一度同期してください" });
    return;
  }
  if (!groupsStoreReady()) {
    res.status(503).json({ error: "共有保存の設定がありません" });
    return;
  }

  try {
    if (req.method === "GET") {
      const data = await readGroups(email);
      res.status(200).json({ ...data, email, count: data.groups.length });
      return;
    }
    if (req.method === "PUT" || req.method === "POST") {
      const body = parseBody(req);
      const saved = await writeGroups(email, body);
      res.status(200).json({ ok: true, email, count: saved.groups.length });
      return;
    }
    res.status(405).json({ error: "method not allowed" });
  } catch {
    res.status(503).json({ error: "グループの保存に失敗しました。時間をおいて再度お試しください" });
  }
}
