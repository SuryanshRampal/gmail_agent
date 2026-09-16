import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's native TypeScript runner requires the .ts extension.
import { scanEmailContent } from "./phishing.ts";

test("post-open scan leaves a normal newsletter low risk", () => {
  const result = scanEmailContent("<p>Race calendar and team news</p>", "The 2027 F1 calendar is here.");
  assert.equal(result.riskLevel, "low_risk");
  assert.deepEqual(result.suspiciousLinks, []);
});

test("post-open scan identifies suspicious links", () => {
  const result = scanEmailContent("<a href=\"https://bit.ly/verify-now\">Review account</a>");
  assert.equal(result.riskLevel, "needs_attention");
  assert.equal(result.suspiciousLinks[0], "https://bit.ly/verify-now");
  assert.ok(result.reasons.some((reason) => reason.includes("unsafe destination")));
});

test("post-open scan identifies credential requests", () => {
  const result = scanEmailContent("<p>Urgent action required</p>", "Verify your account and enter your one-time password.");
  assert.equal(result.riskLevel, "needs_attention");
  assert.equal(result.suspiciousLinks.length, 0);
  assert.equal(result.reasons.length, 2);
});
