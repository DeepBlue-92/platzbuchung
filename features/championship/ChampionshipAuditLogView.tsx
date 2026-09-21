import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  Filter,
  ArrowRight,
  Trophy,
  User as UserIcon,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Download,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { TournamentInstance, ChampionshipAuditLogEntry } from '../../types/championship';
import { User } from '../../types';

interface ChampionshipAuditLogViewProps {
  tournament: TournamentInstance;
  users: Record<string, User>;
  currentUser: User | null;
}

export const ChampionshipAuditLogView: React.FC<ChampionshipAuditLogViewProps> = ({
  tournament,
  currentUser,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const auditLog: ChampionshipAuditLogEntry[] = useMemo(() => {
    return tournament.auditLog || [];
  }, [tournament.auditLog]);

  const filteredLogs = useMemo(() => {
    return auditLog
      .filter((entry) => {
        if (actionFilter !== 'all' && entry.action !== actionFilter) {
          return false;
        }

        if (searchTerm.trim() !== '') {
          const q = searchTerm.toLowerCase();
          const matchParticipant1 = entry.participant1Name.toLowerCase().includes(q);
          const matchParticipant2 = entry.participant2Name.toLowerCase().includes(q);
          const matchUser = entry.userName.toLowerCase().includes(q);
          const matchRound = entry.roundLabel.toLowerCase().includes(q);
          const matchScore = (entry.newResultSummary || '').toLowerCase().includes(q);
          const matchPrev = (entry.previousResultSummary || '').toLowerCase().includes(q);
          if (!matchParticipant1 && !matchParticipant2 && !matchUser && !matchRound && !matchScore && !matchPrev) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [auditLog, actionFilter, searchTerm, sortOrder]);

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(d);
    } catch {
      return iso;
    }
  };

  const getActionBadge = (action: ChampionshipAuditLogEntry['action']) => {
    switch (action) {
      case 'create_result':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Ergebnis eingetragen
          </span>
        );
      case 'update_result':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Edit3 className="w-3 h-3" />
            Ergebnis korrigiert
          </span>
        );
      case 'walkover':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3" />
            w/o (Aufgabe)
          </span>
        );
      case 'delete_result':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <RefreshCw className="w-3 h-3" />
            Ergebnis zurückgesetzt
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
            {action}
          </span>
        );
    }
  };

  const exportCsv = () => {
    if (filteredLogs.length === 0) return;
    const header = [
      'Zeitpunkt',
      'Benutzer',
      'Aktion',
      'Runde',
      'Spieler 1',
      'Spieler 2',
      'Vorheriges Ergebnis',
      'Neues Ergebnis',
      'Sieger',
      'Walkover Grund',
    ];

    const rows = filteredLogs.map((entry) => [
      formatDateTime(entry.timestamp),
      `"${entry.userName.replace(/"/g, '""')}"`,
      `"${entry.action}"`,
      `"${entry.roundLabel.replace(/"/g, '""')}"`,
      `"${entry.participant1Name.replace(/"/g, '""')}"`,
      `"${entry.participant2Name.replace(/"/g, '""')}"`,
      `"${(entry.previousResultSummary || 'Keines').replace(/"/g, '""')}"`,
      `"${entry.newResultSummary.replace(/"/g, '""')}"`,
      `"${entry.winnerName.replace(/"/g, '""')}"`,
      `"${(entry.walkoverReason || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [header.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Audit-Log_${tournament.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const createCount = auditLog.filter((l) => l.action === 'create_result').length;
  const updateCount = auditLog.filter((l) => l.action === 'update_result').length;
  const walkoverCount = auditLog.filter((l) => l.action === 'walkover').length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Summary */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-slate-900 text-white rounded-xl">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Audit-Log (Revisionsverlauf)
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Lückenlose Protokollierung aller Ergebnis-Einträge und nachträglichen Korrekturen
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={exportCsv}
            disabled={filteredLogs.length === 0}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV Exportieren</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
            Gesamt-Einträge
          </span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {auditLog.length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 block">
            Erst-Ergebnisse
          </span>
          <span className="text-2xl font-black text-emerald-700 mt-1 block">
            {createCount}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 block">
            Korrekturen
          </span>
          <span className="text-2xl font-black text-blue-700 mt-1 block">
            {updateCount}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 block">
            Aufgaben / Walkovers
          </span>
          <span className="text-2xl font-black text-amber-700 mt-1 block">
            {walkoverCount}
          </span>
        </div>
      </div>

      {/* Controls & Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Nach Spieler, Erfasser, Runde oder Ergebnis suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[var(--color-primary)] placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 cursor-pointer"
            >
              <option value="all">Alle Aktionen</option>
              <option value="create_result">Ergebnis eingetragen</option>
              <option value="update_result">Ergebnis korrigiert</option>
              <option value="walkover">w/o (Aufgabe)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
            title="Sortierung umkehren"
          >
            {sortOrder === 'desc' ? 'Neueste zuerst' : 'Älteste zuerst'}
          </button>
        </div>
      </div>

      {/* Audit Log Entries List */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center space-y-3">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            {auditLog.length === 0
              ? 'Noch keine Einträge im Audit-Log'
              : 'Keine Einträge für den aktuellen Filter gefunden'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {auditLog.length === 0
              ? 'Sobald Spiele erfasst, Ergebnisse geändert oder Aufgaben gemeldet werden, wird hier jede Transaktion mit Zeitstempel und Erfasser dokumentiert.'
              : 'Versuche, die Suchbegriffe oder Filteroptionen anzupassen.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((entry) => {
            const isWalkover = !!entry.isWalkover || entry.action === 'walkover';
            const wasUpdated = entry.action === 'update_result';

            return (
              <div
                key={entry.id}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col gap-3"
              >
                {/* Header row: Action Badge & Timestamp */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    {getActionBadge(entry.action)}
                    <span className="text-xs font-bold text-slate-700">
                      {entry.roundLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-semibold">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {formatDateTime(entry.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Matchup and Result Diff */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  {/* Left: Players */}
                  <div className="md:col-span-5 space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Partie
                    </span>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span className="truncate">{entry.participant1Name}</span>
                      <span className="text-slate-400 font-normal">vs.</span>
                      <span className="truncate">{entry.participant2Name}</span>
                    </div>
                  </div>

                  {/* Middle: Old Result -> New Result */}
                  <div className="md:col-span-4 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      {wasUpdated ? 'Ergebnisänderung' : 'Ergebnis'}
                    </span>

                    <div className="flex items-center gap-2 text-xs">
                      {wasUpdated && entry.previousResultSummary ? (
                        <>
                          <span className="font-semibold text-slate-400 line-through">
                            {entry.previousResultSummary}
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {entry.newResultSummary}
                          </span>
                        </>
                      ) : (
                        <span className="font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {entry.newResultSummary}
                        </span>
                      )}
                    </div>

                    {isWalkover && entry.walkoverReason && (
                      <span className="text-[10px] text-amber-700 italic block mt-1">
                        Grund: {entry.walkoverReason}
                      </span>
                    )}
                  </div>

                  {/* Right: Winner & Submitter */}
                  <div className="md:col-span-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Trophy className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="font-bold text-slate-800 truncate">
                        Sieger: {entry.winnerName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <UserIcon className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">
                        Erfasst von: <strong className="text-slate-700">{entry.userName}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
