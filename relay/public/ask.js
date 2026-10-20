// The row in the composer's place while the host keeps the tab view only: asking
// to type, waiting for an answer, and hearing "not now".

const NOT_NOW_MS = 4_000;
// The host turns asking away for 20 s after a "not now" (tabshare/people.rs), so
// an ask sooner than that waits until it would be heard.
const ASK_AGAIN_MS = 20_500;

export function createAsk(row, send) {
  const text = row.querySelector(".locked-text");
  const button = row.querySelector("button");
  let state = { canType: false, asked: false, askType: false, hostName: "" };
  let pending = false;
  let declinedAt = -Infinity;
  let declineTimer = 0;
  let askTimer = 0;

  function render() {
    const notNow = Date.now() - declinedAt < NOT_NOW_MS;
    const waiting = state.asked || pending;
    row.hidden = state.canType;
    text.textContent = !state.askType
      ? `${state.hostName || "The host"} hasn't let you type`
      : notNow
        ? "Not now, they said."
        : "Watching only";
    button.hidden = !state.askType || notNow;
    button.disabled = waiting;
    button.textContent = waiting ? "Asked…" : "Ask to type";
  }

  button.addEventListener("click", () => {
    pending = true;
    render();
    clearTimeout(askTimer);
    askTimer = setTimeout(send, Math.max(0, declinedAt + ASK_AGAIN_MS - Date.now()));
  });

  return {
    // `next` is { canType, asked, askType, hostName } from the host's latest word.
    update(next) {
      if (state.asked && !next.asked && !next.canType) {
        declinedAt = Date.now();
        clearTimeout(declineTimer);
        declineTimer = setTimeout(render, NOT_NOW_MS);
      }
      if (next.asked || next.canType) pending = false;
      state = next;
      render();
    },
    // On a new connection the host says afresh whether this guest has asked.
    reset() {
      clearTimeout(askTimer);
      pending = false;
      state = { ...state, asked: false };
    },
  };
}
