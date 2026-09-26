import React from 'react';
import { TournamentInstance } from '../../types/championship';
import { User, RankingState } from '../../types';
import { ChampionshipPrintView } from './ChampionshipPrintView';
import { exportChampionshipToPdf } from '../../utils/championshipPdfExport';
import { X, Printer, Download, FileText } from 'lucide-react';

interface ChampionshipPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: TournamentInstance | null;
  users: Record<string, User>;
  clubName?: string;
  logoUrl?: string;
  rankings?: RankingState | null;
}

export const ChampionshipPrintModal: React.FC<ChampionshipPrintModalProps> = ({
  isOpen,
  onClose,
  tournament,
  users,
  clubName = 'Tennis-Club',
  logoUrl,
  rankings,
}) => {
  if (!isOpen || !tournament) return null;

  const handleDownloadPdf = () => {
    exportChampionshipToPdf(tournament, users, clubName);
  };

  const handlePrint = () => {
    try {
      window.print();
    } catch (err) {
      console.warn('window.print() failed', err);
      // Fallback: download PDF
      exportChampionshipToPdf(tournament, users, clubName);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:hidden animate-in fade-in duration-150">
      <div className="bg-slate-100 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden">
        {/* Modal Header */}
        <div className="bg-white px-4 sm:px-6 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                Druckvorschau & PDF-Export
              </h3>
              <p className="text-xs text-slate-500 truncate">
                {tournament.title} &bull; Offizieller DIN A4 Abschlussbericht
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Als PDF herunterladen"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Als PDF herunterladen</span>
              <span className="inline sm:hidden">PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              title="Drucken über Browser"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Drucken</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Schließen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Paper Sheet Preview */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-200/80">
          <div className="max-w-[210mm] mx-auto bg-white rounded-lg shadow-md border border-slate-300 p-6 sm:p-8">
            <ChampionshipPrintView
              tournament={tournament}
              users={users}
              clubName={clubName}
              logoUrl={logoUrl}
              rankings={rankings}
              previewMode={true}
            />
          </div>
        </div>

        {/* Modal Footer Hinweis */}
        <div className="bg-white px-4 sm:px-6 py-2.5 border-t border-slate-200 text-center text-[11px] text-slate-500 shrink-0">
          💡 Hinweis: Beim Klick auf <strong>„Als PDF herunterladen“</strong> wird das Dokument direkt als Datei gespeichert. Für Direktdruck im Browser-Dialog <em>„Hintergrundgrafiken“</em> aktivieren.
        </div>
      </div>
    </div>
  );
};
