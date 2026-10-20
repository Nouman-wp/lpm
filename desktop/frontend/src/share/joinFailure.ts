export interface JoinFailure {
  title: string;
  text: string;
  // The button that tries once more; null when trying again can't help.
  retry: "Try again" | "Ask again" | null;
  // What went wrong underneath, when it says more than the title.
  detail?: string;
  kind: "offline" | "refused" | "ended" | "other";
}

const UNREACHABLE = "Couldn't reach the machine that shared this tab";

// A failed join as a person reads it. `error` is what peer_share_join (or the
// host behind it) said; `host` is the sharing computer's name, when known.
export function joinFailure(error: string, host: string): JoinFailure {
  const who = host || "They";
  if (error.startsWith(UNREACHABLE)) {
    return {
      kind: "offline",
      title: host ? `Can't reach ${host}` : "Can't reach the computer sharing this tab",
      text: "lpm may be closed there, or the computer asleep or on another network. The link still works once it's back.",
      retry: "Try again",
      detail: error.slice(UNREACHABLE.length).replace(/^:\s*/, "") || undefined,
    };
  }
  switch (error) {
    case "The host didn't let you in.":
      return { kind: "refused", title: `${who} didn't let you in`, text: "If that was a mistake, ask again.", retry: "Ask again" };
    case "The host didn't answer in time.":
      return {
        kind: "refused",
        title: "No answer",
        text: `${who} didn't answer within two minutes. They may have stepped away.`,
        retry: "Ask again",
      };
    case "This invite has ended. Ask for a new one.":
      return { kind: "ended", title: "This link has ended", text: "Sharing stopped. Ask for a new link.", retry: null };
    case "That invite is incomplete. Ask for a new one.":
      return { kind: "ended", title: "This link isn't complete", text: "Ask them to send it again, and copy all of it.", retry: null };
    case "No one is there to let you in right now. Try again later.":
      return {
        kind: "refused",
        title: host ? `No one at ${host} can let you in` : "No one can let you in right now",
        text: "Nobody is at the computer sharing this tab. Ask again once they're back.",
        retry: "Ask again",
      };
    case "Others are already waiting to join this tab. Try again shortly.":
      return { kind: "other", title: "Too many people are asking at once", text: "Try again in a moment.", retry: "Try again" };
    case "The host closed the connection.":
      return { kind: "offline", title: "The connection closed", text: "It dropped before they answered.", retry: "Try again" };
    case "Update lpm to join shared tabs.":
      return { kind: "other", title: "Update lpm to join", text: "Their lpm needs this one to be newer.", retry: null };
    default:
      return { kind: "other", title: "Couldn't join", text: error, retry: "Try again" };
  }
}
