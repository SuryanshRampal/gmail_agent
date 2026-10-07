export type GmailReplySource = {
  threadId: string;
  sender: string;
  recipients?: string;
  replyTo?: string;
  subject: string;
  messageIdHeader?: string;
  references?: string;
  isSent?: boolean;
  isDraft?: boolean;
};

export type GmailReplyHeaders = {
  to: string;
  subject: string;
  threadId: string;
  inReplyTo: string;
  references: string;
};

const EMAIL_PATTERN = /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?/i;
const MESSAGE_ID_PATTERN = /<[^<>\s@]+@[^<>\s@]+>/g;

function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function mailbox(value: string): string | null {
  if (!value || /[\r\n]/.test(value)) return null;
  const match = singleLine(value).match(EMAIL_PATTERN);
  return match?.[0] ?? null;
}

function messageIds(value: string): string[] {
  if (!value || /[\r\n]/.test(value)) return [];
  return singleLine(value).match(MESSAGE_ID_PATTERN) ?? [];
}

export function buildGmailReplyHeaders(source: GmailReplySource): GmailReplyHeaders {
  if (source.isDraft) throw new Error("Save or send this draft before replying to it.");
  const to = mailbox(source.replyTo || (source.isSent ? source.recipients ?? "" : source.sender));
  if (!to) throw new Error("This message does not have a valid reply address.");

  const originalMessageId = messageIds(source.messageIdHeader ?? "")[0];
  if (!originalMessageId) throw new Error("This message is missing the information Gmail needs for a threaded reply.");

  const references = [...new Set([...messageIds(source.references ?? ""), originalMessageId])];
  const threadId = singleLine(source.threadId);
  if (!threadId) throw new Error("This message is missing its Gmail thread.");

  return {
    to,
    subject: singleLine(source.subject) || "(No subject)",
    threadId,
    inReplyTo: originalMessageId,
    references: references.join(" "),
  };
}
