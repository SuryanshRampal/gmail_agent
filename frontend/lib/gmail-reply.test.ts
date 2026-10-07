import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's native TypeScript runner requires the .ts extension.
import { buildGmailReplyHeaders } from "./gmail-reply.ts";

const source = {
  threadId: "thread-1",
  sender: "Sender Name <sender@example.com>",
  subject: "Project update",
  messageIdHeader: "<message-1@example.com>",
};

test("builds the Gmail threading headers from the original message", () => {
  assert.deepEqual(buildGmailReplyHeaders(source), {
    to: "sender@example.com",
    subject: "Project update",
    threadId: "thread-1",
    inReplyTo: "<message-1@example.com>",
    references: "<message-1@example.com>",
  });
});

test("prefers Reply-To and appends the original message to References", () => {
  const result = buildGmailReplyHeaders({
    ...source,
    replyTo: "Support <replies@example.com>",
    references: "<older@example.com> <message-1@example.com>",
  });
  assert.equal(result.to, "replies@example.com");
  assert.equal(result.references, "<older@example.com> <message-1@example.com>");
});

test("replies to the recipient when the original message is in Sent", () => {
  const result = buildGmailReplyHeaders({ ...source, recipients: "Recipient <recipient@example.com>", isSent: true });
  assert.equal(result.to, "recipient@example.com");
});

test("rejects injected or missing reply metadata", () => {
  assert.throws(() => buildGmailReplyHeaders({ ...source, replyTo: "safe@example.com\r\nBcc: attacker@example.com" }), /valid reply address/);
  assert.throws(() => buildGmailReplyHeaders({ ...source, messageIdHeader: undefined }), /threaded reply/);
});
