import React from "react";
import { CheckSquare, CheckCircle2, RotateCcw, X, Loader2 } from "lucide-react";

interface OnboardingBulkActionBarProps {
  selectedCount: number;
  isProcessing: boolean;
  onActivateSelected: () => void;
  onCompleteSelected: () => void;
  onClearSelection: () => void;
}

export const OnboardingBulkActionBar: React.FC<OnboardingBulkActionBarProps> = ({
  selectedCount,
  isProcessing,
  onActivateSelected,
  onCompleteSelected,
  onClearSelection,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div
      id="onboarding-bulk-action-bar"
      className="bg-amber-50/90 border border-amber-200/90 p-3 sm:px-4 sm:py-2.5 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-150"
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
          <CheckSquare className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-bold text-amber-950 truncate">
          <strong>{selectedCount}</strong> {selectedCount === 1 ? "Mitglied ausgewählt" : "Mitglieder ausgewählt"}
        </span>
        <button
          type="button"
          onClick={onClearSelection}
          disabled={isProcessing}
          className="text-[11px] text-amber-800/80 hover:text-amber-950 underline underline-offset-2 ml-1 cursor-pointer font-medium disabled:opacity-50"
        >
          Auswahl aufheben
        </button>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onActivateSelected}
          disabled={isProcessing}
          className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
          title="Onboarding für markierte Mitglieder aktivieren (ausstehend)"
        >
          {isProcessing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RotateCcw className="w-3.5 h-3.5" />
          )}
          <span>Onboarding aktivieren</span>
        </button>

        <button
          type="button"
          onClick={onCompleteSelected}
          disabled={isProcessing}
          className="bg-slate-700 hover:bg-slate-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
          title="Onboarding für markierte Mitglieder als abgeschlossen markieren"
        >
          {isProcessing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
          <span>Als erledigt markieren</span>
        </button>

        <button
          type="button"
          onClick={onClearSelection}
          disabled={isProcessing}
          className="p-1.5 text-amber-800/70 hover:text-amber-950 rounded-lg hover:bg-amber-100/70 transition-colors cursor-pointer"
          aria-label="Auswahl aufheben"
          title="Auswahl aufheben"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
