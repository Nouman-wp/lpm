// An account's sign-in as the accounts list reads it.
export interface ClaudeLoginStatus {
  signedIn: boolean;
  email: string;
  // "Max 20x", "Pro"…; empty when the plan isn't known.
  planLabel: string;
}

// "Signed in as ada@example.com · Max 20x", leaving out whatever isn't known.
export function signedInLine({ email, planLabel }: ClaudeLoginStatus): string {
  const who = email ? `Signed in as ${email}` : "Signed in";
  return planLabel ? `${who} · ${planLabel}` : who;
}
