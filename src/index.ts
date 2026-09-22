import "dotenv/config";
import Database from "better-sqlite3";
import { Bot, Context, InlineKeyboard } from "grammy";
import fs from "node:fs";
import path from "node:path";

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is required");
const admins = new Set((process.env.ADMIN_USER_IDS ?? "").split(",").map(Number).filter(Number.isInteger));
const dbPath = process.env.DATABASE_PATH ?? "./data/promo-codes.db";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.exec("CREATE TABLE IF NOT EXISTS promo_codes (id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, source TEXT NOT NULL, submitted_by INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', redeemed_by INTEGER, value TEXT, wager TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
for (const column of ["value", "wager"]) { try { db.exec("ALTER TABLE promo_codes ADD COLUMN " + column + " TEXT"); } catch {} }

function admin(ctx: Context) { return !!ctx.from && admins.has(ctx.from.id); }
function details(text: string) {
  const code = text.match(/code\s*:\s*([A-Za-z0-9][A-Za-z0-9_-]{3,31})/i)?.[1]?.toUpperCase();
  const value = text.match(/value\s*:\s*([$€£]?\s?[\d,.]+)/i)?.[1]?.replace(/\s+/g, "");
  const wager = text.match(/(?:7[- ]day\s+)?wager\s*:\s*([$€£]?\s?[\d,.]+)/i)?.[1]?.replace(/\s+/g, "");
  return code ? { code, value: value ?? null, wager: wager ?? null } : null;
}
async function submit(ctx: Context, text: string) {
  if (!ctx.from) return;
  const found = details(text);
  if (!found) return void await ctx.reply("I couldn't find a promo code. Look for a line like Code: ABC123.");
  try {
    db.prepare("INSERT INTO promo_codes (code, source, submitted_by, value, wager) VALUES (?, ?, ?, ?, ?)").run(found.code, text.slice(0, 4000), ctx.from.id, found.value, found.wager);
    const extra = [found.value ? "Value: " + found.value : null, found.wager ? "Wager: " + found.wager : null].filter(Boolean).join(" | ");
    await ctx.reply("✅ " + found.code + " — pending approval" + (extra ? "\n" + extra : ""));
  } catch {
    await ctx.reply("ℹ️ " + found.code + " — already submitted");
  }
}
function codeKeyboard(rows: { id: number; code: string }[]) {
  const keyboard = new InlineKeyboard();
  for (const row of rows) keyboard.text("📋 Copy " + row.code, { copy_text: { text: row.code } }).row();
  return keyboard;
}
const bot = new Bot(token);
bot.command("start", ctx => ctx.reply("Forward a promo-code post here. Use /codes to view approved codes."));
bot.command("codes", async ctx => {
  const q = ctx.match.trim().toUpperCase();
  const rows = db.prepare("SELECT id, code, value, wager FROM promo_codes WHERE status='approved' AND code LIKE ? ORDER BY id DESC LIMIT 30").all("%" + q + "%") as {id:number;code:string;value:string|null;wager:string|null}[];
  if (!rows.length) return void await ctx.reply("No approved codes found.");
  await ctx.reply(rows.map(r => "#" + r.id + " — " + r.code + (r.value ? "\nValue: " + r.value : "") + (r.wager ? "\nWager: " + r.wager : "")).join("\n"), { reply_markup: codeKeyboard(rows) });
});
bot.command("pending", async ctx => {
  if (!admin(ctx)) return void await ctx.reply("Admin access is required.");
  const rows = db.prepare("SELECT id, code, submitted_by FROM promo_codes WHERE status='pending' ORDER BY id").all() as {id:number;code:string;submitted_by:number}[];
  await ctx.reply(rows.length ? rows.map(r => "#" + r.id + " — " + r.code + " — user " + r.submitted_by).join("\\n") : "No pending submissions.");
});
for (const action of ["approve", "reject"] as const) bot.command(action, async ctx => {
  if (!admin(ctx)) return void await ctx.reply("Admin access is required.");
  const id = Number(ctx.match.trim());
  const status = action === "approve" ? "approved" : "rejected";
  const result = db.prepare("UPDATE promo_codes SET status=? WHERE id=? AND status='pending'").run(status, id);
  await ctx.reply(result.changes ? action[0].toUpperCase() + action.slice(1) + "d #" + id : "Pending code not found.");
});
bot.command("redeem", async ctx => {
  if (!ctx.from) return;
  const id = Number(ctx.match.trim());
  const result = db.prepare("UPDATE promo_codes SET redeemed_by=? WHERE id=? AND status='approved' AND redeemed_by IS NULL").run(ctx.from.id, id);
  await ctx.reply(result.changes ? "Marked as redeemed." : "Code unavailable or already redeemed.");
});
bot.on("message:text", ctx => submit(ctx, ctx.message.text));
bot.on("message:caption", ctx => submit(ctx, ctx.message.caption ?? ""));
bot.catch(err => console.error(err));
bot.start({ onStart: info => console.log("Running as @" + info.username) });
