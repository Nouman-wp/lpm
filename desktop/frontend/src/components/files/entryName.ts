import { isLinux, isWindows } from "../../platform";

export interface NameRules {
  // Linux disks tell "a" from "A"; macOS and Windows ones, by default, don't.
  caseSensitive: boolean;
  windows: boolean;
}

const HOST_RULES: NameRules = { caseSensitive: isLinux, windows: isWindows };
const WINDOWS_DEVICE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

// Why `name` can't name an entry in a folder holding `siblings`, or null when
// it can. `current` is the entry being renamed: its own name is no clash, so a
// new spelling of it is a rename.
export function entryNameProblem(
  name: string,
  siblings: readonly string[],
  current: string | null = null,
  rules: NameRules = HOST_RULES,
): string | null {
  if (name.trim() === "") return "Enter a name";
  if (name === "." || name === "..") return `"${name}" isn't a valid name`;
  if (/[/\\]/.test(name)) return "A name can't contain / or \\";
  if (/\p{Cc}/u.test(name)) return "A name can't contain control characters";
  if (rules.windows) {
    if (/[<>:"|?*]/.test(name)) return 'A name can\'t contain < > : " | ? *';
    if (/[. ]$/.test(name)) return "A name can't end with a dot or a space";
    if (WINDOWS_DEVICE.test(name.split(".")[0].trimEnd())) return `"${name}" is reserved by Windows`;
  }
  const fold = (s: string) => (rules.caseSensitive ? s : s.toLowerCase());
  const clash = siblings.some((s) => s !== current && fold(s) === fold(name));
  return clash ? `${name} already exists` : null;
}
