/**
 * Group destination expansion shared by the Telegram bot and the source listener.
 * Telegram supergroup Bot API chat IDs use a -100 prefix. ABCKNOX's own /chatid reply gave the signed ID -5271704394.
 * Never guess a -100 prefix from an unsigned suffix.
 * Keep every preconfigured destination; append only the new group and dedupe.
 */
export const ABCKNOX_CHAT_ID = -5271704394;

export function resolveDestinationChatIds(configured: string): number[] {
  const existing = configured
    .split(",")
    .map(value => Number(value.trim()))
    .filter(id => Number.isSafeInteger(id) && id !== 0);
  return [...new Set([...existing, ABCKNOX_CHAT_ID])];
}

/** Only direct private conversations may submit a code for manual review.
 * In particular, groups not yet present in DESTINATION_CHAT_IDS must stay silent. */
export function acceptsManualPromoSubmission(chatType: string | undefined): boolean {
  return chatType === "private";
}
