// The bar over a shared tab: whose it is, whether it's live, what this guest may
// do in it, and who else is watching.

const $ = (id) => document.getElementById(id);

export function initial(name) {
  return Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "";
}

export function othersText(names) {
  const [first, ...rest] = names;
  if (!first) return "";
  if (rest.length === 0) return `${first} is here too`;
  if (rest.length === 1) return `${first} and ${rest[0]} are here too`;
  return `${first} and ${rest.length} others are here too`;
}

export function showShare({ hostName, label, project, canType, others }) {
  const avatar = $("live-avatar");
  avatar.textContent = initial(hostName || label);
  avatar.hidden = !avatar.textContent;
  $("live-label").textContent = label || "Shared tab";
  $("live-project").textContent = project;
  $("access").textContent = canType ? "Can type" : "View only";
  $("access").classList.toggle("on", canType);
  $("others").hidden = others.length === 0;
  $("others").title = others.join(", ");
  $("others-text").textContent = othersText(others);
}

export function showStatus(text, connected) {
  $("status-text").textContent = text;
  $("status").title = text;
  $("status").classList.toggle("connected", connected);
}
