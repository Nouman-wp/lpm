import { RowMenu } from "./RowMenu";
import { RowMenuItem } from "./RowMenuItem";
import { LaptopIcon } from "../../connections/LaptopIcon";
import { MACHINE } from "../../../machineWords";
import type { JobMachine } from "../../../jobsFormat";
import type { MachineChoice } from "../../../peer/machineChoices";
import {
  listedMachines,
  machinesNote,
  machinesSummary,
  runsOnAny,
  toggleAnyMachine,
  toggleMachine,
} from "../../../jobsMachines";

const HEADER_CLASS =
  "px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]";

// Which computers the job runs on, as one button: one or more of them, best
// first, or any that's on. Whichever comes first and is on takes each run.
export function JobMachinesMenu({
  value,
  choices,
  names,
  myId,
  onChange,
}: {
  // hostIds, best first, "any" last; empty for a job every computer runs.
  value: string[];
  choices: MachineChoice[];
  // How the computer the job lives on names the ones it lists, for any this
  // one doesn't know.
  names?: JobMachine[];
  myId: string;
  onChange: (next: string[]) => void;
}) {
  const nameOf = (id: string) =>
    id === myId
      ? MACHINE.ThisMachineTitle
      : choices.find((c) => c.id === id)?.label ||
        names?.find((n) => n.id === id)?.name ||
        MACHINE.AnotherMachine;
  const listed = listedMachines(value);
  const rows = [
    ...choices.map((c) => c.id),
    ...listed.filter((id) => !choices.some((c) => c.id === id)),
  ];
  const summary = machinesSummary(value, nameOf);
  // A job from before computers were named runs on every one; picking one
  // starts its list.
  const pick = (id: string) => onChange(value.length === 0 ? [id] : toggleMachine(value, id));

  return (
    <RowMenu
      variant="pill"
      icon={<LaptopIcon size={13} />}
      label={summary}
      ariaLabel={`Runs on ${summary}`}
      menuClassName="w-max min-w-[240px] max-w-[min(360px,calc(100vw-32px))] overflow-y-auto p-1"
    >
      {() => (
        <>
          <div className={HEADER_CLASS}>Runs on</div>
          {rows.map((id) => (
            <RowMenuItem
              key={id}
              label={nameOf(id)}
              active={listed.includes(id)}
              onClick={() => pick(id)}
            />
          ))}
          <div className="mx-1 my-1 border-t border-[var(--border)]" />
          <RowMenuItem
            label={`Any available ${MACHINE.noun}`}
            active={runsOnAny(value)}
            onClick={() => onChange(toggleAnyMachine(value, myId))}
          />
          <p className="max-w-[300px] px-2.5 pb-1.5 pt-1 text-[11.5px] leading-snug text-[var(--text-muted)]">
            {machinesNote(value, nameOf)}
          </p>
        </>
      )}
    </RowMenu>
  );
}
