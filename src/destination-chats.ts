/**
 * Group destination expansion shared by the Telegram bot and the source listener.
 * Telegram supergroup Bot API chat IDs use a -100 prefix. ABCKNOX's supplied
 * numeric identifier was 5271704394, giving -1005271704394 for a supergroup.
 * Keep every preconfigured destination; append only the new group and dedupe.
 */
export const ABCKNOX_CHAT_ID = -1005271704394;

export function resolveDestinationChatIds(configured: string): number[] {
  const existing = configured
    .split(",")
    .map(value => Number(value.trim()))
    .filter(id => Number.isSafeInteger(id) && id !== 0);
  return [...new Set([...existing, ABCKNOX_CHAT_ID])];
}
