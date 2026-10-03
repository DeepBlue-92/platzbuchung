import React, { useState } from "react";
import { Mail, Pencil } from "lucide-react";
import { VariableBadgeRenderer } from "./VariableBadgeRenderer";

interface CanvasSubjectHeaderProps {
  subject: string;
  onChangeSubject: (newSubject: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

/**
 * Subject Line header card above the email canvas.
 * Renders dynamic variable badges directly inside the subject box, exactly like in the template.
 * Clicking into the box activates inline text editing.
 */
export const CanvasSubjectHeader: React.FC<CanvasSubjectHeaderProps> = ({
  subject,
  onChangeSubject,
  inputRef,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleStartEditing = () => {
    setIsEditing(true);
    setTimeout(() => {
      inputRef?.current?.focus();
    }, 40);
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (document.activeElement !== inputRef?.current) {
        setIsEditing(false);
      }
    }, 200);
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/70 flex items-center justify-center shrink-0">
            <Mail className="w-3.5 h-3.5" />
          </div>
          <div>
            <label
              htmlFor="canvas-subject-field"
              onClick={handleStartEditing}
              className="text-[11px] font-black uppercase tracking-wider text-slate-800 block cursor-pointer"
            >
              Posteingang Betreffzeile
            </label>
            <p className="text-[10px] text-slate-500 font-medium">
              Vom Empfänger direkt in der Posteingangsliste gesehen
            </p>
          </div>
        </div>
      </div>

      {/* Main Subject Box: Variable badges rendered directly inside the box like in the template */}
      <div className="relative">
        {isEditing ? (
          <input
            id="canvas-subject-field"
            ref={inputRef as any}
            data-field="subject"
            type="text"
            value={subject}
            onChange={(e) => onChangeSubject(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setIsEditing(false);
              }
            }}
            placeholder="z. B. Buchung bestätigt: [Platz-Bezeichnung] am [Datum] ([Uhrzeit])"
            className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-600 ring-2 ring-emerald-100 text-xs sm:text-sm font-bold text-slate-900 bg-white focus:outline-none transition-colors shadow-2xs placeholder-slate-400 min-h-[44px]"
            title="Betreffzeile eingeben"
            autoFocus
          />
        ) : (
          <div
            onClick={handleStartEditing}
            className="group w-full px-3.5 py-2.5 rounded-xl border border-slate-300 hover:border-emerald-600 bg-slate-50/70 hover:bg-white text-xs sm:text-sm font-bold text-slate-900 transition-colors shadow-2xs cursor-text min-h-[44px] flex items-center justify-between gap-2"
            title="Klicken zum Bearbeiten des Betreffs"
          >
            <div className="flex-1 min-w-0 flex items-center flex-wrap gap-1 leading-relaxed">
              {subject && subject.trim().length > 0 ? (
                <VariableBadgeRenderer text={subject} />
              ) : (
                <span className="italic text-slate-400 text-xs sm:text-sm font-normal">
                  z. B. Buchung bestätigt: [Platz-Bezeichnung] am [Datum] ([Uhrzeit])
                </span>
              )}
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-emerald-700 p-0.5 shrink-0">
              <Pencil className="w-3.5 h-3.5" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
