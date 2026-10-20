import { JoinStep } from "./JoinStep";

// Where a join stands: reaching the sharing computer, waiting to be let in,
// then the tab itself.
export function JoinSteps({ reached, host, label }: { reached: boolean; host: string; label: string }) {
  const machine = host || "their computer";
  return (
    <div className="flex flex-col">
      <JoinStep state={reached ? "done" : "now"}>{reached ? `Reached ${machine}` : `Reaching ${machine}`}</JoinStep>
      <JoinStep state={reached ? "now" : "next"}>{`Waiting for ${host || "them"} to let you in`}</JoinStep>
      <JoinStep state="next" last>
        {`Watch ${label || "the tab"} live`}
      </JoinStep>
    </div>
  );
}
