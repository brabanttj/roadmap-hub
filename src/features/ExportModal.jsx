import { useState } from "react";
import { Modal, Select, Button } from "../components/ui/index.js";
import { MONTH_NAMES } from "../lib/text.js";
import { exportRoadmapToExcel } from "../lib/exportExcel.js";

const REFERENCE_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [REFERENCE_YEAR - 1, REFERENCE_YEAR, REFERENCE_YEAR + 1];
const MONTH_OPTIONS = MONTH_NAMES.map((name, idx) => ({ value: idx + 1, label: name }));

export default function ExportModal({ initiatives, onClose }) {
  // Blank ("") on either side of either bound means "no limit" there --
  // e.g. leaving Start blank and only setting an End exports everything up
  // through that month. Unscheduled (Backlog) initiatives are exported
  // regardless of this range (see exportRoadmapToExcel).
  const [startYear, setStartYear] = useState("");
  const [startMonth, setStartMonth] = useState("");
  const [endYear, setEndYear] = useState("");
  const [endMonth, setEndMonth] = useState("");
  const [done, setDone] = useState(null); // row count once exported
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const count = await exportRoadmapToExcel(initiatives, {
        startYear: startYear ? Number(startYear) : null,
        startMonth: startMonth ? Number(startMonth) : null,
        endYear: endYear ? Number(endYear) : null,
        endMonth: endMonth ? Number(endMonth) : null,
      });
      setDone(count);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal title="Export roadmap to Excel" onClose={onClose}>
      <p className="rb-intro" style={{ marginTop: 0 }}>
        Exports every Backlog, In Development, and Completed initiative --
        never ideas awaiting review, rejected ideas, or archived ones -- with
        both Team and Focus Area as columns. Optionally narrow it to a date
        range below; unscheduled Backlog initiatives are always included.
      </p>

      <div className="im-form__row">
        <Select label="From year" value={startYear} onChange={(e) => setStartYear(e.target.value)}>
          <option value="">Any</option>
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
        <Select label="From month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)}>
          <option value="">Any</option>
          {MONTH_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="im-form__row">
        <Select label="Through year" value={endYear} onChange={(e) => setEndYear(e.target.value)}>
          <option value="">Any</option>
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
        <Select label="Through month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)}>
          <option value="">Any</option>
          {MONTH_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </div>

      {done != null && (
        <p className="rb-intro" style={{ color: "var(--lt-green-darken-2)" }}>
          Exported {done} initiative{done === 1 ? "" : "s"}.
        </p>
      )}

      <div className="im-form__actions">
        <div className="im-form__actions-right" style={{ marginLeft: "auto" }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            {done != null ? "Close" : "Cancel"}
          </Button>
          <Button type="button" variant="accent" onClick={handleExport} disabled={exporting}>
            {exporting ? "Exporting…" : "Export"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
