export type EyeState = "shown" | "hidden" | "partly";

const EYE_TITLES: Record<EyeState, string> = {
  shown: "Shown — click to hide",
  hidden: "Hidden — click to show",
  partly: "Partly shown — click to show all",
};

/**
 * Show/hide eye, used wherever something can be switched on/off on the map (Your map items and
 * groups, saved search filters): solid when shown, faint when hidden, half-faded when partly shown.
 */
export function Eye({
  state,
  label,
  onToggle,
  disabled = false,
}: {
  state: EyeState;
  label: string;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`saved-eye is-${state}`}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={state !== "hidden"}
      aria-label={`${state === "shown" ? "Hide" : "Show"} ${label} on the map`}
      title={EYE_TITLES[state]}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M1.8 12s3.7-6.6 10.2-6.6S22.2 12 22.2 12s-3.7 6.6-10.2 6.6S1.8 12 1.8 12z" />
        <circle cx="12" cy="12" r="3.1" />
      </svg>
    </button>
  );
}
