import { useState } from "react";

import { pathLength } from "../engine/geometry";
import { useMapUi } from "../mapUiStore";
import { LIMITS } from "../savedStorage";
import { useSaved } from "../savedStore";
import { NameColorForm } from "./NameColorForm";

/**
 * The measuring tool: while active, map clicks add points. Shows the running distance and saves the
 * line as a named path. Visible while measuring or while an unsaved line remains.
 */
export function MeasurePanel() {
  const measuring = useMapUi((state) => state.measuring);
  const points = useMapUi((state) => state.measurement);
  const undo = useMapUi((state) => state.undoMeasurePoint);
  const finish = useMapUi((state) => state.finishMeasure);
  const clear = useMapUi((state) => state.clearMeasure);
  const pathCount = useSaved((state) => state.paths.length);
  const addPath = useSaved((state) => state.addPath);
  const [formOpen, setFormOpen] = useState(false);

  if (!measuring && points.length === 0) return null;

  const canSave = points.length >= 2 && pathCount < LIMITS.paths;
  const status = measuring
    ? points.length
      ? "Click the map to add the next point"
      : "Click the map to start measuring"
    : "Finished — save it or clear it";

  function close() {
    setFormOpen(false);
    clear();
  }

  return (
    <div className="measure-panel" role="region" aria-label="Measure distance">
      <div className="measure-heading">
        <span>
          <small>MEASURE</small>
          <strong>{status}</strong>
        </span>
        {measuring && (
          <button onClick={finish} title="Stop adding points (Esc)">
            Done
          </button>
        )}
      </div>
      <div className="measure-summary">
        <span>
          <small>POINTS</small>
          <strong>{points.length}</strong>
        </span>
        <span>
          <small>DISTANCE</small>
          <strong>{Math.round(pathLength(points)).toLocaleString()} tiles</strong>
        </span>
      </div>

      {formOpen ? (
        <NameColorForm
          initialName=""
          initialColor="amber"
          placeholder="Supply run, patrol, shortcut…"
          submitLabel="Save path"
          note={`Saved on this computer · ${pathCount}/${LIMITS.paths}`}
          onSubmit={(name, color) => {
            if (addPath(points, name, color)) close();
          }}
          onCancel={() => setFormOpen(false)}
        />
      ) : (
        <div className="card-actions">
          <button onClick={undo} disabled={points.length === 0}>
            Undo point
          </button>
          <button onClick={close} disabled={points.length === 0}>
            Clear
          </button>
          <button
            className="primary-action"
            onClick={() => setFormOpen(true)}
            disabled={!canSave}
            title={pathCount >= LIMITS.paths ? `You can save up to ${LIMITS.paths} paths` : undefined}
          >
            Save as path
          </button>
        </div>
      )}
    </div>
  );
}
