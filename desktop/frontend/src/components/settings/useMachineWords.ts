import { useContext } from "react";
import { MACHINE } from "../../machineWords";
import { SettingsTargetContext } from "./settingsTarget";

// How copy names the machine the Settings view configures: this one in its own
// words, a connected one by its name. Outside Settings it is this one.
export function useMachineWords(): { thisMachine: string; ThisMachine: string } {
  const machine = useContext(SettingsTargetContext)?.machine;
  return machine?.kind === "peer"
    ? { thisMachine: machine.name, ThisMachine: machine.name }
    : { thisMachine: MACHINE.thisMachine, ThisMachine: MACHINE.ThisMachine };
}
