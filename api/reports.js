import { defaultStructuredReport, getStructuredReport } from "./_shared.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const { zodiac, period, userKundli } = req.body || {};
    if (!zodiac || !period) {
      res.status(400).json({ error: "Missing zodiac or period in request body." });
      return;
    }

    const report = await getStructuredReport({
      zodiac: String(zodiac),
      period,
      userKundli,
    });

    res.status(200).json({ report });
  } catch (error) {
    console.error("/api/reports error:", error);
    const zodiac = req.body && req.body.zodiac ? String(req.body.zodiac) : "Your";
    const period = req.body && req.body.period ? req.body.period : "daily";
    res.status(200).json({ report: defaultStructuredReport(zodiac, period) });
  }
}
