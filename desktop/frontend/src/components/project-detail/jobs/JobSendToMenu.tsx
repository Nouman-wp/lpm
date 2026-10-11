import { ExternalLink, Plus, Send } from "lucide-react";
import { BrowserOpenURL } from "../../../../bridge/runtime";
import { RowMenu } from "./RowMenu";
import { RowMenuItem } from "./RowMenuItem";
import {
  LPM_DESTINATION,
  SEND_TO_OPTIONS,
  normalizeSendTo,
  sendToReady,
  sendToSummary,
  splitSendTo,
  targetId,
  type SendToLinks,
} from "../../../sendTo";
import type { ConnectIntent } from "../../../sendToConnectors";
import { sendToRequestUrl } from "../../../githubIssue";

const HEADER_CLASS =
  "px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]";

// Where the job's results go, as one button: lpm, and any of the chats each
// outside service is linked to. A service that isn't linked yet can be
// connected right from the menu, and a linked one can take another chat.
export function JobSendToMenu({
  value,
  onChange,
  links,
  onConnect,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  links: SendToLinks;
  onConnect: (service: string, intent: ConnectIntent) => void;
}) {
  const picked = normalizeSendTo(value, links);
  const summary = sendToSummary(picked, links);
  const warn = picked.length === 0 || picked.some((id) => sendToReady(id, links) === false);
  const toggle = (id: string) =>
    onChange(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);

  return (
    <RowMenu
      variant="pill"
      icon={<Send size={13} />}
      tone={warn ? "warn" : "normal"}
      label={summary}
      ariaLabel={`Send to ${summary}`}
      menuClassName="w-max min-w-[240px] max-w-[min(340px,calc(100vw-32px))] overflow-y-auto p-1"
    >
      {(close) => (
        <>
          <div className={HEADER_CLASS}>Send results to</div>
          <RowMenuItem
            label="lpm"
            active={picked.includes(LPM_DESTINATION)}
            onClick={() => toggle(LPM_DESTINATION)}
          />
          {SEND_TO_OPTIONS.filter((o) => o.id !== LPM_DESTINATION).map((o) => {
            const link = links[o.id];
            const connect = (intent: ConnectIntent) => {
              close();
              if (intent === "connect" && !picked.includes(o.id)) onChange([...picked, o.id]);
              onConnect(o.id, intent);
            };
            if (!link?.connected) {
              return (
                <div key={o.id} className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    <RowMenuItem
                      label={o.label}
                      active={picked.includes(o.id)}
                      onClick={() => toggle(o.id)}
                    />
                  </div>
                  {link && o.connectable && (
                    <button
                      type="button"
                      onClick={() => connect("connect")}
                      className="shrink-0 rounded-md px-2 py-1 text-[12px] font-medium text-[var(--accent-cyan-text)] transition-colors hover:bg-[var(--bg-hover)]"
                    >
                      Connect
                    </button>
                  )}
                </div>
              );
            }
            return (
              <div key={o.id}>
                <div className="mx-1 my-1 border-t border-[var(--border)]" />
                <div className={HEADER_CLASS}>{o.label}</div>
                {link.targets.map((t) => {
                  const id = targetId(o.id, t.key);
                  return (
                    <RowMenuItem
                      key={id}
                      label={t.name}
                      active={picked.includes(id)}
                      onClick={() => toggle(id)}
                    />
                  );
                })}
                {picked
                  .filter((id) => splitSendTo(id).service === o.id && sendToReady(id, links) === false)
                  .map((id) => (
                    <RowMenuItem
                      key={id}
                      label={`${splitSendTo(id).key} · removed`}
                      active
                      onClick={() => toggle(id)}
                    />
                  ))}
                {o.connectable && (
                  <button
                    type="button"
                    onClick={() => connect("add")}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                  >
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                      <Plus size={13} />
                    </span>
                    Add a chat
                  </button>
                )}
              </div>
            );
          })}
          <div className="mx-1 my-1 border-t border-[var(--border)]" />
          <button
            type="button"
            onClick={() => {
              close();
              BrowserOpenURL(sendToRequestUrl());
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
              <ExternalLink size={12} />
            </span>
            Request another place
          </button>
        </>
      )}
    </RowMenu>
  );
}
