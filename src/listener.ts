import "dotenv/config";
import Database from "better-sqlite3";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage } from "telegram/events";
import fs from "node:fs";
import path from "node:path";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const session = process.env.TELEGRAM_SESSION;
const botToken = process.env.BOT_TOKEN;
const dbPath = process.env.DATABASE_PATH ?? "./data/promo-codes.db";
const sources = (process.env.SOURCE_CHANNELS ?? "@thrilldrops,@Thrillcom,3085902874").split(",").map(s => s.trim()).filter(Boolean);
const destinations = (process.env.DESTINATION_CHAT_IDS ?? "-1002312794442,-1003653622779").split(",").map(Number).filter(Number.isInteger);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.exec("CREATE TABLE IF NOT EXISTS drop_alert_subscribers (chat_id INTEGER NOT NULL, user_id INTEGER NOT NULL, display_name TEXT NOT NULL, PRIMARY KEY (chat_id, user_id))");

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char] ?? char));
}

if (!apiId || !apiHash || !session || !botToken) {
  console.warn("Channel listener disabled: Telegram credentials are required.");
} else {
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 5 });
  await client.connect();
  client.addEventHandler(async event => {
    const text = event.message.message ?? "";
    const code = text.match(/code\s*:\s*([A-Za-z0-9][A-Za-z0-9_-]{3,31})/i)?.[1]?.toUpperCase();
    if (!code) return;
    const value = text.match(/value\s*:\s*([$€£]?\s?[\d,.]+)/i)?.[1]?.replace(/\s+/g, "");
    const wager = text.match(/(?:7[- ]day\s+)?wager\s*:\s*([$€£]?\s?[\d,.]+)/i)?.[1]?.replace(/\s+/g, "");
    const loss = text.match(/(?:7[- ]day\s+)?loss\s*:\s*([$€£]?\s?[\d,.]+)/i)?.[1]?.replace(/\s+/g, "");
    const claims = text.match(/claims\s*:\s*([\d,.]+)/i)?.[1];
    const body = "🔥 <b>THRILL DROP</b>" +
      (value ? "\n\n<b>Value:</b> " + value : "") +
      (claims ? "\n<b>Claims:</b> " + claims : "") +
      (wager ? "\n<b>7-Day Wager:</b> " + wager : "") +
      (loss ? "\n<b>7-Day Loss:</b> " + loss : "");

    for (const chatId of destinations) {
      const rows = db.prepare("SELECT user_id, display_name FROM drop_alert_subscribers WHERE chat_id=?").all(chatId) as { user_id: number; display_name: string }[];
      const mentions = rows.map(row => '<a href="tg://user?id=' + row.user_id + '">' + escapeHtml(row.display_name) + "</a>").join(" ");
      const tagLine = mentions ? "\n\n🔔 " + mentions : "";
      await fetch("https://api.telegram.org/bot" + botToken + "/sendMessage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: body + tagLine,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[{ text: code, copy_text: { text: code } }]] }
        })
      });
    }
    console.log("Forwarded code " + code + " from monitored channel");
  }, new NewMessage({ chats: sources }));
  console.log("Channel listener active for " + sources.join(", "));
}
