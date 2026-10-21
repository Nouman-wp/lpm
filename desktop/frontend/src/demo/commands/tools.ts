import type { CommandMap } from "../backend";

const VERSION = "1.0.0";
let skillInstalled = false;
let cliInstalled = false;

// A fresh install offers the agent skill and the lpm CLI until they're
// installed; the sample workspace has both.
export function seedTools(installed: boolean): void {
  skillInstalled = installed;
  cliInstalled = installed;
}

export const toolCommands: CommandMap = {
  agent_skill_status: () => ({
    status: skillInstalled ? "installed" : "not-installed",
    installedVersion: skillInstalled ? VERSION : null,
    bundledVersion: VERSION,
  }),
  cli_install_status: () => ({
    status: cliInstalled ? "installed" : "not-installed",
    linkPath: "/usr/local/bin/lpm",
    cliVersion: cliInstalled ? VERSION : null,
  }),
  install_agent_skill: () => {
    skillInstalled = true;
    return null;
  },
  install_cli: () => {
    cliInstalled = true;
    return null;
  },
};
