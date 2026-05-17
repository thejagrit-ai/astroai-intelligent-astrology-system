import { defaultHoroscopeText, getHoroscopeReply } from "./_shared.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const { zodiac } = req.body || {};
    if (!zodiac) {
      res.status(400).json({ error: "Missing zodiac in request body." });
      return;
    }

    const text = await getHoroscopeReply(String(zodiac));
    res.status(200).json({ text });
  } catch (error) {
    console.error("/api/horoscope error:", error);
    const zodiac = req.body && req.body.zodiac ? String(req.body.zodiac) : "Your";
    res.status(200).json({ text: defaultHoroscopeText(zodiac) });
  }
}
