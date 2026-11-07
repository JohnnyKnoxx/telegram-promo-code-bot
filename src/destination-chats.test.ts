import { test } from "node:test";
import assert from "node:assert/strict";
import { ABCKNOX_CHAT_ID, resolveDestinationChatIds } from "./destination-chats.js";

test("adds ABCKNOX without dropping existing Railway destinations", () => {
  assert.equal(ABCKNOX_CHAT_ID, -1005271704394);
  assert.deepEqual(
    resolveDestinationChatIds("-1002312794442,-1003653622779"),
    [-1002312794442, -1003653622779, -1005271704394]
  );
});

test("preserves independently configured group IDs and avoids duplicates", () => {
  assert.deepEqual(
    resolveDestinationChatIds(" -1004444444444, -1005271704394, -1004444444444 "),
    [-1004444444444, -1005271704394]
  );
});

test("fails closed on nonnumeric or zero chat IDs", () => {
  assert.deepEqual(resolveDestinationChatIds("garbage,0,Infinity,1.2"), [ABCKNOX_CHAT_ID]);
});

test("works when there are no configured groups", () => {
  assert.deepEqual(resolveDestinationChatIds(""), [ABCKNOX_CHAT_ID]);
});

test("does not answer ordinary group and supergroup conversations", async () => {
  const { acceptsManualPromoSubmission } = await import("./destination-chats.js");
  assert.equal(acceptsManualPromoSubmission("supergroup"), false);
  assert.equal(acceptsManualPromoSubmission("group"), false);
  assert.equal(acceptsManualPromoSubmission("channel"), false);
  assert.equal(acceptsManualPromoSubmission(undefined), false);
  assert.equal(acceptsManualPromoSubmission("private"), true);
});
