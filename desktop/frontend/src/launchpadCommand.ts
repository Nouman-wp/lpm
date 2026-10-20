// A launchpad line meant for a shell rather than the agent, written the way a
// shell prompt shows it: "$ npm test". The command without its "$", or null.
// "$HOME/…" stays a prompt: the "$" has to stand on its own.
export function launchpadCommand(text: string): string | null {
  const match = /^\$(?:\s+|$)/.exec(text);
  return match ? text.slice(match[0].length).trim() : null;
}
