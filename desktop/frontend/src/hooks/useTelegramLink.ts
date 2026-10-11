import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  TelegramConnect,
  TelegramDisconnect,
  TelegramFindChats,
  TelegramRemoveChat,
  TelegramTest,
} from "../../bridge/commands";
import { targetId, type SendToTarget } from "../sendTo";
import { useSendToStatus } from "../store/sendToStatus";

const FIND_CHATS_EVERY_MS = 2500;

// Linking Telegram, wherever it's done: save the bot's token, then keep looking
// for chats — the user's first message to the bot, or the bot being added to a
// group or channel — while lpm is waiting for one or `watch` asks it to.
// `onAdded` hears the destination ids of each chat that turns up.
export function useTelegramLink({
  watch = false,
  onAdded,
}: { watch?: boolean; onAdded?: (ids: string[]) => void } = {}) {
  const status = useSendToStatus((s) => s.telegram);
  const refresh = useSendToStatus((s) => s.refresh);
  const [busy, setBusy] = useState(false);
  const onAddedRef = useRef(onAdded);
  onAddedRef.current = onAdded;

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const waiting = !!status?.hasToken && !status.connected;
  const looking = !!status?.hasToken && (waiting || watch);

  useEffect(() => {
    if (!looking) return;
    let stopped = false;
    const look = () =>
      TelegramFindChats()
        .then((added: SendToTarget[]) => {
          if (stopped || !Array.isArray(added) || added.length === 0) return;
          toast.success(
            added.length === 1
              ? `Telegram can now post in ${added[0].name}`
              : `Telegram can now post in ${added.length} more chats`,
          );
          onAddedRef.current?.(added.map((c) => targetId("telegram", c.key)));
          void refresh();
        })
        .catch(() => {});
    void look();
    const timer = setInterval(look, FIND_CHATS_EVERY_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [looking, refresh]);

  const run = async (work: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    try {
      await work();
    } catch (err) {
      toast.error(`${failure}: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return {
    status,
    waiting,
    looking,
    busy,
    bot: status?.bot ? `@${status.bot}` : "your bot",
    // `text` is the token, or anything holding it.
    connect: (text: string) =>
      run(async () => {
        await TelegramConnect(text);
        await refresh();
      }, "Couldn't connect Telegram"),
    disconnect: () =>
      run(async () => {
        await TelegramDisconnect();
        await refresh();
      }, "Couldn't disconnect Telegram"),
    test: (key?: string) =>
      run(async () => {
        await TelegramTest(key);
        toast.success("Test message sent");
      }, "Couldn't send the test message"),
    removeChat: (key: string) =>
      run(async () => {
        await TelegramRemoveChat(key);
        await refresh();
      }, "Couldn't remove the chat"),
  };
}
