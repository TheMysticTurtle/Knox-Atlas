import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { markerColors } from "../engine/colors";
import type { MarkerColor, SavedGroup } from "../engine/types";
import { LIMITS, MARKER_COLORS, cleanLabel } from "../savedStorage";

type NameColorFormProps = {
  initialName: string;
  initialColor: MarkerColor;
  placeholder: string;
  submitLabel: string;
  /** Small print under the form, e.g. "Saved on this computer · 3/100". */
  note?: string;
  /** The section's groups; a Group picker appears when there are any. */
  groups?: SavedGroup[];
  initialGroup?: string;
  /** `group` is the chosen group id, or undefined for "No group". */
  onSubmit: (name: string, color: MarkerColor, group?: string) => void;
  onCancel: () => void;
  /** Extra controls on the button row (e.g. Delete when editing). */
  extra?: ReactNode;
};

/** Name + colour (+ group, once the section has groups) — shared by every save form. */
export function NameColorForm({
  initialName,
  initialColor,
  placeholder,
  submitLabel,
  note,
  groups = [],
  initialGroup,
  onSubmit,
  onCancel,
  extra,
}: NameColorFormProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<MarkerColor>(initialColor);
  // Only keep a group that still exists (it may have been deleted since).
  const [group, setGroup] = useState(
    groups.some((item) => item.id === initialGroup) ? (initialGroup ?? "") : "",
  );
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cleanLabel(name)) {
      setError("Give it a name first.");
      inputRef.current?.focus();
      return;
    }
    onSubmit(name, color, group || undefined);
  }

  return (
    <form className="name-color-form" onSubmit={submit}>
      <input
        ref={inputRef}
        value={name}
        maxLength={LIMITS.label}
        placeholder={placeholder}
        autoComplete="off"
        aria-label="Name"
        onChange={(event) => {
          setName(event.target.value);
          setError("");
        }}
      />
      <div className="color-swatches" role="radiogroup" aria-label="Colour">
        {MARKER_COLORS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={color === option}
            aria-label={option}
            title={option}
            className={`color-swatch${color === option ? " is-chosen" : ""}`}
            style={{ background: markerColors[option] }}
            onClick={() => setColor(option)}
          />
        ))}
      </div>
      {groups.length > 0 && (
        <label className="group-picker">
          Group
          <select value={group} onChange={(event) => setGroup(event.target.value)}>
            <option value="">No group</option>
            {groups.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="form-actions">
        <button type="submit" className="primary-action">
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        {extra}
      </div>
      {(error || note) && (
        <span className={error ? "form-note is-error" : "form-note"} role={error ? "alert" : undefined}>
          {error || note}
        </span>
      )}
    </form>
  );
}
