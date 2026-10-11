import type { RefObject } from "react";
import { toast } from "sonner";
import { DeleteMemorySession, RenameMemorySession } from "../../bridge/commands";
import { useMemorySessions } from "../hooks/useMemorySessions";
import type { MentionItem } from "../mentions";
import { memoryInvocation } from "../terminalMemory";
import { ComposerMemoryButton } from "./ComposerMemoryButton";
import { caretInside, insertTextAtCaret, lineBeforeCaret, placeCaretAtEnd } from "./composerEditor";

export interface InputComposerMemorySource {
  // The project whose memory sessions are offered (a duplicate lists its
  // original's).
  project: string;
  // The agent CLI the prompt goes to, which decides the invocation's form.
  agent: string | null;
}

interface InputComposerMemoryProps extends InputComposerMemorySource {
  editorRef: RefObject<HTMLDivElement | null>;
  onInserted: () => void;
}

// The terminal composer's memory list for a prompt box that isn't a terminal:
// picking a session writes its skill invocation into the prompt, so the agent
// that later runs it continues — or starts — that session. Hidden for projects
// without local memory (SSH).
export function InputComposerMemory({ project, agent, editorRef, onInserted }: InputComposerMemoryProps) {
  const { items, byId, enabled, reload } = useMemorySessions(project, true);
  if (!enabled) return null;

  // Parks the caret first (the button can be clicked before the field was ever
  // focused) so the padding space is decided from where the text lands.
  const pick = (item: MentionItem) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    if (!caretInside(editor)) placeCaretAtEnd(editor);
    const line = lineBeforeCaret(editor);
    const pad = line && !/\s$/.test(line) ? " " : "";
    if (insertTextAtCaret(editor, `${pad}${memoryInvocation(agent, item.insert)}`)) onInserted();
  };

  const remove = async (item: MentionItem) => {
    try {
      await DeleteMemorySession(project, item.insert);
      reload();
    } catch (err) {
      toast.error(`Delete memory: ${String(err)}`);
    }
  };

  const rename = async (item: MentionItem, name: string) => {
    try {
      await RenameMemorySession(project, item.insert, name);
      reload();
    } catch (err) {
      toast.error(`Rename memory: ${String(err)}`);
    }
    editorRef.current?.focus();
  };

  return (
    <ComposerMemoryButton
      sessions={items}
      infoById={byId}
      onOpen={reload}
      onPick={pick}
      onRename={(item, name) => void rename(item, name)}
      onDelete={(item) => void remove(item)}
    />
  );
}
