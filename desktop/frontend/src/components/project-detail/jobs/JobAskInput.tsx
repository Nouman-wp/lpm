import type { InputHTMLAttributes } from "react";
import { isImeComposing } from "../../../imeComposing";
import { modalInputClass } from "../../../forms/styles";

// A one-line answer box. Enter that commits an IME candidate stays with the
// IME instead of sending the form.
export function JobAskInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      onKeyDown={(e) => {
        if (e.key === "Enter" && isImeComposing(e)) e.preventDefault();
      }}
      className={`${modalInputClass} ${className}`}
    />
  );
}
