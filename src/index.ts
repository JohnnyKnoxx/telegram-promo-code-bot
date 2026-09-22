import "dotenv/config";
import Database from "better-sqlite3";
import { Bot, Context } from "grammy";
import fs from "node:fs";
import path from "node:path";

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is required");
const admins = new Set((process.env.ADMIN_USER_IDS ?? "").split(",").map(Number).filter(Number.isInteger));
const dbPath = process.env.DATABASE_PATH ?? "./data/promo-codes.db";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.exec("CREATE TABLE IF NOT EXISTS promo_codes (id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, source TEXT NOT NULL, submitted_by INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', redeemed_by INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");

function admin(ctx: Context) { return !!ctx.from && admins.has(ctx.from.id); }
function codes(text: string) {
  const match = text.match(/code\s*:\s*([A-Za-z0-9][A-Za-z0-9_-]{3,31})/i);
  return match ? [match[1].toUpperCase()] : [];
}
async function submit(ctx: Context, text: string) {
  if (!ctx.from) return;
  const found = codes(text);
  if (!found.length) return void await ctx.reply("I couldn't find a promo code. Look for a line like Code: ABC123.");
  const out: string[] = [];
  for (const code of found) {
    try { db.prepare("INSERT INTO promo_codes (code, source, submitted_by) VALUES (?, ?, ?)").run(code, text.slice(0, 4000), ctx.from.id); out.push("✅ " + code + " — pending approval"); }
    catch { out.push("ℹ️ " + code + " — already submitted"); }
  }
  await ctx.reply(out.join("\\n"));
}
const bot = new Bot(token);
bot.command("start", ctx => ctx.reply("Forward a promo-code post here. Use /codes to view approved codes."));
bot.command("codes", async ctx => {
  const q = ctx.match.trim().toUpperCase();
  const rows = db.prepare("SELECT id, code FROM promo_codes WHERE status='approved' AND code LIKE ? ORDER BY id DESC LIMIT 30").all("%" + q + "%") as {id:number;code:string}[];
  await ctx.reply(rows.length ? rows.map(r => "#" + r.id + " — " + r.code).join("\\n") : "No approved codes found.");
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
