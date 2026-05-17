import { getChatReply } from "./_shared.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const { userKundli, history, userMessage, options } = req.body || {};
    const message = typeof userMessage === 'string' ? userMessage : req.body?.message;
    if (!message) {
      res.status(400).json({ error: "Invalid payload for chat request." });
      return;
    }

    const reply = await getChatReply({ message, userKundli, history, options });
    res.status(200).json({ reply, text: reply });
  } catch (error) {
    console.error("/api/chat error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Something went wrong. Please try again." });
  }
}
