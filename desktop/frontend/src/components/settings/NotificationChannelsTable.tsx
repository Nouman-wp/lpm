import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  channelEnabled,
  offersChannel,
  type NotificationChannel,
} from "../../notifications/channels";
import type { NotificationEvent } from "../../notifications/types";
import type { Settings } from "../../store/settings";

interface NotificationChannelsTableProps {
  settings: Settings;
  update: (patch: Partial<Settings>) => unknown;
}

/** One row per kind of news, one column per way it can reach you. A cell is
 *  written only when it's changed; the rest keep following their defaults. */
export function NotificationChannelsTable({ settings, update }: NotificationChannelsTableProps) {
  const set = (event: NotificationEvent, channel: NotificationChannel, on: boolean) => {
    const prefs = settings.notificationChannels ?? {};
    void update({ notificationChannels: { ...prefs, [event]: { ...prefs[event], [channel]: on } } });
  };

  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full min-w-[22rem] text-[13px]">
        <thead>
          <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              Event
            </th>
            {NOTIFICATION_CHANNELS.map((c) => (
              <th key={c.id} scope="col" className="w-20 px-2 py-2 text-center font-semibold">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {NOTIFICATION_EVENTS.map((e) => (
            <tr key={e.id} className="border-b border-[var(--border)] last:border-0">
              <th scope="row" className="px-3 py-2 text-left font-normal text-[var(--text-primary)]">
                {e.label}
                {e.hint && <span className="block text-[11px] text-[var(--text-muted)]">{e.hint}</span>}
              </th>
              {NOTIFICATION_CHANNELS.map((c) => (
                <td key={c.id} className="px-2 py-2 text-center">
                  {offersChannel(e.id, c.id) ? (
                    <input
                      type="checkbox"
                      aria-label={`${e.label}: ${c.label}`}
                      checked={channelEnabled(settings, e.id, c.id)}
                      onChange={(ev) => set(e.id, c.id, ev.target.checked)}
                      className="h-[15px] w-[15px] cursor-pointer accent-[var(--accent-blue)]"
                    />
                  ) : (
                    <span className="text-[var(--text-muted)]" aria-label="Not offered">
                      –
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
