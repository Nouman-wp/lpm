// Links that open a new, filled-in issue on lpm's GitHub repo, for feedback
// and for asking for something lpm doesn't do yet.

import { SEND_TO_OPTIONS } from "./sendTo";

export const ISSUES_REPO = "gug007/lpm";

// encodeURIComponent leaves !'()*~ alone; GitHub's prefill is happier with
// every one of them escaped.
function strictEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*~]/g,
    (character) => "%" + character.charCodeAt(0).toString(16).toUpperCase(),
  );
}

export function newIssueUrl({
  title,
  body,
  labels = [],
}: {
  title: string;
  body: string;
  labels?: string[];
}): string {
  const query = [`title=${strictEncode(title)}`, `body=${strictEncode(body)}`];
  if (labels.length > 0) query.push(`labels=${strictEncode(labels.join(","))}`);
  return `https://github.com/${ISSUES_REPO}/issues/new?${query.join("&")}`;
}

// An issue asking for one more place automations can send their results.
export function sendToRequestUrl(): string {
  const supported = SEND_TO_OPTIONS.map((o) => o.label).join(", ");
  return newIssueUrl({
    title: "Send to: ",
    body: [
      "**Where should automations be able to send their results?**",
      "<!-- Slack, Discord, email, a webhook, … -->",
      "",
      "**What would you use it for?**",
      "",
      "",
      "---",
      `Already supported: ${supported}`,
    ].join("\n"),
    labels: ["enhancement"],
  });
}
