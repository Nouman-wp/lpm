const commits = (n: number) => `${n} commit${n === 1 ? "" : "s"}`;

export function pushedText(ahead: number, branch: string): string {
  if (ahead <= 0) return branch ? `Pushed ${branch}` : "Pushed";
  return branch ? `Pushed ${commits(ahead)} from ${branch}` : `Pushed ${commits(ahead)}`;
}

export function pulledText(behind: number, branch: string): string {
  if (behind <= 0) return branch ? `Pulled ${branch}` : "Pulled";
  return branch ? `Pulled ${commits(behind)} into ${branch}` : `Pulled ${commits(behind)}`;
}

export function syncedText(behind: number, ahead: number, branch: string): string {
  const what = `Pulled ${behind}, pushed ${commits(ahead)}`;
  return branch ? `${what} on ${branch}` : what;
}
