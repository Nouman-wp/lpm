import { ImageIcon } from "lucide-react";

export interface SendPrompt {
  text: string;
  imageCount: number;
}

const IMAGE_TOKEN = /\[Image #\d+\]/g;

// The prompt a picker is about to hand off, so the tab it came from is never in
// doubt: its first lines, and how many images ride along.
export function SendPromptPreview({ prompt }: { prompt: SendPrompt }) {
  const text = prompt.text.replace(IMAGE_TOKEN, " ").replace(/\s+/g, " ").trim();
  if (!text && prompt.imageCount === 0) return null;
  return (
    <div className="mx-3 mt-2.5 flex flex-col gap-1 rounded-lg bg-[var(--bg-secondary)] px-3 py-2">
      {text && (
        <p className="line-clamp-2 text-[12px] leading-snug text-[var(--text-primary)]">{text}</p>
      )}
      {prompt.imageCount > 0 && (
        <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
          <ImageIcon size={11} strokeWidth={1.75} />
          {prompt.imageCount === 1 ? "1 image" : `${prompt.imageCount} images`}
        </span>
      )}
    </div>
  );
}
