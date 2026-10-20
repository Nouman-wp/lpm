export function EmojiButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="flex aspect-square items-center justify-center rounded-md text-xl transition-colors hover:bg-[var(--bg-hover)] data-[active]:bg-[var(--bg-hover)]"
    >
      {children}
    </button>
  );
}
