import { User } from "lucide-react";
import { MAIN_LOGIN } from "../../../claudePoolText";
import { useAgentLimits } from "../../../hooks/useAgentLimits";
import type { JobAccount } from "../../../hooks/useJobAccount";
import { useNow } from "../../../hooks/useNow";
import { accountMeters } from "../../../sidebarUsage";
import { PlusIcon } from "../../icons";
import { JobAccountRow } from "./JobAccountRow";
import { RowMenu } from "./RowMenu";

const HEADER_CLASS =
  "px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]";

// Which Claude account an AI prompt automation's runs use: the one its
// projects use (the main login when it runs standalone), or one of its own.
// `value` is null to follow the projects and "" for the main login.
export function JobAccountMenu({
  account,
  value,
  standalone,
  host,
  onChange,
  onAdd,
}: {
  account: JobAccount;
  value: string | null;
  standalone: boolean;
  host: string | null;
  onChange: (value: string | null) => void;
  onAdd: () => void;
}) {
  const { limits } = useAgentLimits(host);
  const now = useNow(true, 60000);
  const { source, defaultName, fallback, inUse, label, signedIn } = account;
  const chip = inUse === null ? "Each project's account" : label(inUse);
  const detail = (id: string) => (signedIn(id) ? undefined : "Not signed in");
  const meters = (id: string) => (signedIn(id) ? accountMeters(limits, id, now) : []);

  return (
    <RowMenu
      variant="pill"
      icon={<User size={13} />}
      tone={account.signedOut ? "warn" : "normal"}
      label={chip}
      ariaLabel={`Claude account: ${chip}`}
      menuClassName="w-72 overflow-y-auto p-1"
    >
      {(close) => {
        const pick = (next: string | null) => {
          onChange(next);
          close();
        };
        return (
          <>
            <div className={HEADER_CLASS}>Claude account</div>
            {!standalone && (
              <>
                <JobAccountRow
                  label={defaultName}
                  detail={fallback === null ? undefined : label(fallback)}
                  active={value === null}
                  onClick={() => pick(null)}
                />
                <div className="mx-1 my-1 border-t border-[var(--border)]" />
              </>
            )}
            <JobAccountRow
              label={label(MAIN_LOGIN)}
              detail={detail(MAIN_LOGIN)}
              meters={meters(MAIN_LOGIN)}
              active={standalone ? value === null || value === "" : value === ""}
              onClick={() => pick(standalone ? null : "")}
            />
            {source.accounts.map((a) => (
              <JobAccountRow
                key={a.id}
                label={a.label}
                detail={detail(a.id)}
                meters={meters(a.id)}
                active={value === a.id}
                onClick={() => pick(a.id)}
              />
            ))}
            <div className="mx-1 my-1 border-t border-[var(--border)]" />
            {source.accounts.length === 0 && (
              <p className="px-2.5 pb-1 pt-0.5 text-[11.5px] leading-snug text-[var(--text-muted)]">
                Add another Claude login to run automations on it.
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                close();
                onAdd();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center [&_svg]:h-3.5 [&_svg]:w-3.5">
                <PlusIcon />
              </span>
              Add account…
            </button>
          </>
        );
      }}
    </RowMenu>
  );
}
