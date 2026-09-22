import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import input from "input";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
if (!apiId || !apiHash) throw new Error("Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env first.");
const client = new TelegramClient(new StringSession(""), apiId, apiHash, { connectionRetries: 5 });
await client.start({
  phoneNumber: async () => input.text("Telegram phone number: "),
  password: async () => input.text("2FA password (if enabled): "),
  phoneCode: async () => input.text("Telegram verification code: "),
  onError: err => console.error(err)
});
console.log("\nTELEGRAM_SESSION=" + client.session.save());
await client.disconnect();
