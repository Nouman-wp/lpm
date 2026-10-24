import { useState, useEffect, useCallback, useMemo } from "react";
import { chordLetter } from "../keyEvents";
import { isMac } from "../platform";
import { useKeyboardShortcut } from "./useKeyboardShortcut";

export function useYamlEditor(
  load: () => Promise<string>,
  save: (content: string) => Promise<void>,
  validate?: (content: string) => string | null,
) {
  const [content, setContent] = useState("");
  const [original, setOriginal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const dirty = content !== original;
  const validationError = useMemo(
    () => validate?.(content) ?? null,
    [content, validate],
  );

  useEffect(() => {
    load()
      .then((data) => { setContent(data); setOriginal(data); setLoaded(true); })
      .catch((err) => setError(`Failed to load: ${err}`));
  }, [load]);

  // Puts `next` in the editor and saves it, for content that arrives whole
  // rather than typed (an AI-generated config).
  const saveContent = useCallback(
    async (next: string) => {
      setContent(next);
      const invalid = validate?.(next) ?? null;
      if (invalid) {
        setError(invalid);
        return;
      }
      setSaving(true);
      setError(null);
      try {
        await save(next);
        setOriginal(next);
      } catch (err) {
        setError(`${err}`);
      } finally {
        setSaving(false);
      }
    },
    [save, validate],
  );

  const handleSave = useCallback(() => saveContent(content), [saveContent, content]);

  useKeyboardShortcut({ key: "s", meta: true, whileTyping: false }, () => {
    if (dirty) handleSave();
  });

  // Off macOS the ⌘S above is Ctrl+Shift+S (keys.ts toPhysical); inside the
  // editor plain Ctrl+S saves too, as in any other editor there.
  const handleSaveKey = isMac
    ? undefined
    : (e: React.KeyboardEvent<HTMLElement>) => {
        if (e.defaultPrevented || !e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;
        if (chordLetter(e.nativeEvent) !== "s" || !e.currentTarget.contains(e.target as Node)) return;
        e.preventDefault();
        if (dirty) handleSave();
      };

  const handleTab = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + "  " + content.substring(end);
      setContent(newContent);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  };

  return {
    content,
    setContent,
    loaded,
    dirty,
    saving,
    error,
    validationError,
    handleSave,
    saveContent,
    handleSaveKey,
    handleTab,
  };
}
