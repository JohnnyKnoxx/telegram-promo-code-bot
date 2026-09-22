import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage } from "telegram/events";
import { Api } from "telegram";
const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const session = process.env.TELEGRAM_SESSION;
const botToken = process.env.BOT_TOKEN;
const sources = (process.env.SOURCE_CHANNELS ?? "@thrilldrops,@Thrillcom,3085902874").split(",").map(s => s.trim()).filter(Boolean);
const destinations = (process.env.DESTINATION_CHAT_IDS ?? "-1002312794442,-1003653622779").split(",").map(Number).filter(Number.isInteger);\nconst dbPath = process.env.DATABASE_PATH ?? "./data/promo-codes.db";\nimport fs from "node:fs";\nimport path from "node:path";\nfs.mkdirSync(path.dirname(dbPath), { recursive: true });\nconst db = new Database(dbPath);\ndb.exec("CREATE TABLE IF NOT EXISTS drop_alert_subscribers (chat_id INTEGER NOT NULL, user_id INTEGER NOT NULL, display_name TEXT NOT NULL, PRIMARY KEY (chat_id, user_id))");

if (!apiId || !apiHash || !session || !botToken) {
  console.warn("Channel listener disabled: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION, and BOT_TOKEN are required.");
} else {
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 5 });
  await client.connect();
  client.addEventHandler(async event => {
    const message = event.message;
    const text = [message.message, message.message ? "" : "", (message as any).media?.caption ?? ""].join("\n");
    const code = text.match(/code\s*:\s*([A-Za-z0-9][A-Za-z0-9_-]{3,31})/i)?.[1]?.toUpperCase();
    if (!code) return;
    const value = text.match(/value\s*:\s*([$€£]?\s?[\d,.]+)/i)?.[1]?.replace(/\s+/g, "");
    const wager = text.match(/(?:7[- ]day\s+)?wager\s*:\s*([$€£]?\s?[\d,.]+)/i)?.[1]?.replace(/\s+/g, "");
    const loss = text.match(/(?:7[- ]day\s+)?loss\s*:\s*([$€£]?\s?[\d,.]+)/i)?.[1]?.replace(/\s+/g, "");
    const claims = text.match(/claims\s*:\s*([\d,.]+)/i)?.[1];
    const valid = text.match(/valid\s+till\s*:\s*([^\\n]+)/i)?.[1]?.trim();
    const body = "🎁 <b>New Thrill promo code</b>\n\n<code>" + code + "</code>" +
      (value ? "\nValue: " + value : "") + (wager ? "\nWager: " + wager : "");
    for (const chatId of destinations) {\n      const subscribers = db.prepare("SELECT user_id, display_name FROM drop_alert_subscribers WHERE chat_id=?").all(chatId) as {user_id:number;display_name:string}[];\n      const mentions = subscribers.map(s => `<a href="tg://user?id=${s.user_id}">${s.display_name.replace(/[&<>"]/g, "")}</a>`).join(" ");\n      const tagLine = mentions ? "\\n\\n🔔 " + mentions : "";
      await fetch("https://api.telegram.org/bot" + botToken + "/sendMessage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: body + tagLine, parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: code, copy_text: { text: code } }]] } })
      });
    }
    console.log("Forwarded code " + code + " from monitored channel");
  }, new NewMessage({ chats: sources }));
  console.log("Channel listener active for " + sources.join(", "));
}
