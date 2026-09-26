import React, { useState, useRef, useEffect } from 'react';
import { Trophy, Settings, Download, Printer, FileSpreadsheet, ChevronDown, FileText } from 'lucide-react';
import { TournamentInstance } from '../../types/championship';
import { User } from '../../types';
import { exportChampionshipToExcel } from '../../utils/championshipExport';
import { exportChampionshipToPdf } from '../../utils/championshipPdfExport';

export type ChampionshipPhaseKey = 'groups' | 'semis' | 'finals' | 'admin';

interface ChampionshipBentoHeaderProps {
  tournament: TournamentInstance;
  activeTournaments: TournamentInstance[];
  selectedTournamentId: string;
  onSelectTournamentId: (id: string) => void;
  activePhase?: ChampionshipPhaseKey;
  onSelectPhase?: (phase: 'groups' | 'semis' | 'finals') => void;
  isAdmin?: boolean;
  onNavigateToAdmin?: () => void;
  onSelectAdmin?: () => void;
  users?: Record<string, User>;
  clubName?: string;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  onPrint?: () => void;
  onOpenPrintPreview?: () => void;
}

export const ChampionshipBentoHeader: React.FC<ChampionshipBentoHeaderProps> = ({
  tournament,
  activeTournaments,
  selectedTournamentId,
  onSelectTournamentId,
  activePhase,
  isAdmin = false,
  onNavigateToAdmin,
  onSelectAdmin,
  users = {},
  clubName = 'Tennis-Club',
  onExportExcel,
  onExportPdf,
  onPrint,
  onOpenPrintPreview,
}) => {
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Click outside listener for export menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    if (isExportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExportMenuOpen]);

  const handleExportExcelClick = () => {
    setIsExportMenuOpen(false);
    if (onExportExcel) {
      onExportExcel();
    } else {
      exportChampionshipToExcel(tournament, users, clubName);
    }
  };

  const handleExportPdfClick = () => {
    setIsExportMenuOpen(false);
    if (onExportPdf) {
      onExportPdf();
    } else {
      exportChampionshipToPdf(tournament, users, clubName);
    }
  };

  const handlePrintClick = () => {
    setIsExportMenuOpen(false);
    if (onOpenPrintPreview) {
      onOpenPrintPreview();
    } else if (onPrint) {
      onPrint();
    } else {
      try {
        window.print();
      } catch (err) {
        console.warn('window.print() not available, falling back to PDF download', err);
        exportChampionshipToPdf(tournament, users, clubName);
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4 print:hidden">
      {/* 1. Kopfzeile wie bei der Rangliste */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Links: Quadratisch abgerundetes Icon-Badge + Titel & Untertitel */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-2xl text-[var(--color-primary)] shrink-0">
            <Trophy className="w-5 h-5 text-[var(--color-primary)]" strokeWidth={1.8} />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-xl font-bold text-slate-900 uppercase tracking-wider">
                Meisterschaft
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-medium tracking-wide mt-1">
              Aktuelle Wettbewerbe und Ergebnisse
            </p>
          </div>
        </div>

        {/* Rechts: Aktionsleiste (Export & Verwaltung) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Export-Aktionsbutton mit Dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shadow-2xs"
              title="Turnier exportieren oder drucken"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Exportieren</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Export & Druck
                  </span>
                  <span className="text-xs font-semibold text-slate-800 truncate block">
                    {tournament.title}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleExportPdfClick}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-rose-50 text-slate-700 hover:text-rose-950 transition-colors flex items-center gap-2.5 group cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 group-hover:bg-rose-200">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold block text-slate-800 group-hover:text-rose-950">
                      PDF-Bericht herunterladen (.pdf)
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      DIN A4 Abschlussbericht mit K.-o.-Baum & Tabellen
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleExportExcelClick}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 transition-colors flex items-center gap-2.5 group cursor-pointer mt-0.5"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-200">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold block text-slate-800 group-hover:text-emerald-950">
                      Excel-Tabelle herunterladen (.xlsx)
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      Endstand, Gruppen & Begegnungen
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handlePrintClick}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors flex items-center gap-2.5 group cursor-pointer mt-0.5"
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 group-hover:bg-slate-200">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold block text-slate-800">
                      Druckvorschau & Drucken
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      Bericht ansehen & im Browser drucken
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Button "Turnier-Verwaltung" (für Admins) */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                if (onNavigateToAdmin) {
                  onNavigateToAdmin();
                } else if (onSelectAdmin) {
                  onSelectAdmin();
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activePhase === 'admin'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
              title="Turnier-Einstellungen & Verwaltung"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Turnier-Verwaltung</span>
              <span className="inline sm:hidden">Verwaltung</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Horizontale Turnier-Pill-Leiste direkt UNTERHALB des Untertitels */}
      {activeTournaments.length > 0 && (
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 w-full max-w-full">
            {activeTournaments.map((t) => {
              const isActive = t.id === selectedTournamentId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTournamentId(t.id)}
                  className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[var(--color-primary)] text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {t.title}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};


