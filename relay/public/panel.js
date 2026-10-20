import { initial } from "./header.js";

// The page's screens before and after the shared tab itself: the greeting, the
// wait to be let in, and whatever ended it.

const $ = (id) => document.getElementById(id);

export function show(id) {
  $("panel").hidden = id !== "panel";
  $("live").hidden = id !== "live";
}

function tile(text) {
  const span = document.createElement("span");
  span.textContent = text;
  return span;
}

// `step` fills that much of the bar over joining (1 to 3); `code` is the four
// emoji or digits to check.
export function panel({
  title = "",
  text = "",
  step = 0,
  greet = false,
  code = null,
  form = false,
  again = false,
  cancel = false,
}) {
  show("panel");
  $("brand").hidden = step > 0;
  $("steps").hidden = step === 0;
  for (const [i, bar] of [...$("steps").children].entries()) bar.classList.toggle("done", i < step);
  $("greet").hidden = !greet;
  $("heading").hidden = greet;
  $("panel-title").textContent = title;
  $("panel-text").textContent = text;
  $("panel-text").hidden = !text;
  $("check").hidden = !code;
  $("check-code").replaceChildren(...(code ?? []).map(tile));
  $("check-code").setAttribute("aria-label", code?.join(" ") ?? "");
  $("join-form").hidden = !form;
  $("again").hidden = !again;
  $("cancel").hidden = !cancel;
  $("fine").hidden = !form;
  if (form) $("name").focus();
}

// What the invite names, before anyone is let in. The host is a computer's name,
// not a person's.
export function greet({ hostName, label, project }) {
  $("greet-avatar").textContent = initial(hostName || label);
  $("greet-from").textContent = hostName ? `Shared from ${hostName}` : "Shared with you from lpm";
  $("greet-label").textContent = label || "A terminal tab";
  $("greet-project").textContent = project;
  $("greet-project").hidden = !project;
  if (label) document.title = `${label} · lpm`;
}
