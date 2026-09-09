import { quotaStatus } from "./_quota.js";

export default async function handler(_req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    res.status(200).json(await quotaStatus());
  } catch {
    res.status(503).json({ blocked: true, error: "quota unavailable" });
  }
}
