import { useEffect, useRef, useState } from "react";
import { ChevronDown, RotateCw, X } from "lucide-react";
import { useLiveToasts } from "./liveToasts";
import { ToastCopyButton } from "./ToastCopyButton";
import { ToastIcon } from "./ToastIcon";
import { ToastProgressBar } from "./ToastProgressBar";
import { errorCopyText, plainText } from "./toastText";
import type { ToastAction, ToastId, ToastModel } from "./types";
import "./toastCard.css";

interface ToastCardProps {
  id: ToastId;
  onResize: () => void;
  onClose: () => void;
}

/** A lone action sits beside the title; anything richer gets a row of buttons. */
function inlineAction(model: ToastModel): ToastAction | undefined {
  const plain = !model.cancel && !model.retry && !model.details && !model.quote && !model.content;
  return plain && model.actions.length === 1 && model.kind !== "error" ? model.actions[0] : undefined;
}

const errorText = (model: ToastModel) =>
  errorCopyText(plainText(model.title), plainText(model.description), model.details);

export function ToastCard({ id, onResize, onClose }: ToastCardProps) {
  const model = useLiveToasts((s) => s.toasts.find((t) => t.id === id));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const resized = useRef(onResize);
  resized.current = onResize;
  const toggled = useRef(false);

  useEffect(() => {
    if (toggled.current) resized.current();
    toggled.current = true;
  }, [detailsOpen]);

  if (!model) return null;

  const run = (action: ToastAction) => {
    onClose();
    action.onClick();
  };
  const { retry, cancel } = model;
  const inline = inlineAction(model);
  const buttons = inline ? [] : model.actions;
  const hasFooter = buttons.length > 0 || cancel || retry || model.kind === "error";
  const timed = Number.isFinite(model.duration) && model.kind !== "loading";

  return (
    <div className="toast-card" data-kind={model.kind} role={model.kind === "error" ? "alert" : "status"}>
      <div className="toast-head">
        <ToastIcon kind={model.kind} />
        <div className="toast-text">
          <div className="toast-title-row">
            <span className="toast-title">{model.title}</span>
            {model.tag && <span className="toast-tag">{model.tag}</span>}
            {model.count > 1 && <span className="toast-count">×{model.count}</span>}
          </div>
          {model.description && <div className="toast-description">{model.description}</div>}
        </div>
        {inline && (
          <button type="button" className="toast-button toast-button-inline" onClick={() => run(inline)}>
            {inline.label}
          </button>
        )}
        <button type="button" className="toast-close" aria-label="Dismiss" onClick={onClose}>
          <X size={14} aria-hidden />
        </button>
      </div>

      {model.quote && <blockquote className="toast-quote">{model.quote}</blockquote>}
      {model.content && <div className="toast-content">{model.content}</div>}
      {model.progress && <ToastProgressBar progress={model.progress} />}
      {model.details && detailsOpen && <pre className="toast-details">{model.details}</pre>}

      {hasFooter && (
        <div className="toast-footer">
          {retry && (
            <button type="button" className="toast-button toast-button-solid" onClick={() => run({ label: "Retry", onClick: retry })}>
              <RotateCw size={13} aria-hidden />
              Retry
            </button>
          )}
          {buttons.map((action, i) => (
            <button
              key={action.label}
              type="button"
              className={`toast-button${i === 0 && !retry ? " toast-button-solid" : ""}`}
              onClick={() => run(action)}
            >
              {action.label}
            </button>
          ))}
          {cancel && (
            <button type="button" className="toast-button toast-button-quiet" onClick={() => run(cancel)}>
              {cancel.label}
            </button>
          )}
          {model.kind === "error" && <ToastCopyButton text={errorText(model)} />}
          {model.details && (
            <button
              type="button"
              className="toast-button toast-button-quiet toast-details-toggle"
              aria-expanded={detailsOpen}
              onClick={() => setDetailsOpen((open) => !open)}
            >
              {detailsOpen ? "Hide details" : "Details"}
              <ChevronDown size={13} aria-hidden data-open={detailsOpen || undefined} />
            </button>
          )}
        </div>
      )}

      {timed && (
        <span
          key={`${model.shownAt}-${model.count}`}
          className="toast-countdown"
          style={{ animationDuration: `${model.duration}ms` }}
          aria-hidden
        />
      )}
    </div>
  );
}
