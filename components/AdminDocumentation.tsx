import React, { useState } from "react";
import { BookOpen, Settings, CreditCard, Shield } from "lucide-react";

// MAINTENANCE NOTE: Nach jedem System-Release muss dieser Prompt zusammen mit dem neuen Code ausgeführt werden, um dieses Daten-Array inkrementell zu aktualisieren.

interface Chapter {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  renderContent: (setActiveChapter: (id: string) => void) => React.ReactNode;
}

export const AdminDocumentation: React.FC = () => {
  const [activeChapterId, setActiveChapterId] = useState<string>("kapitel1");

  const documentationData: Chapter[] = [
    {
      id: "kapitel1",
      title: "1. Systemsteuerung & Modulaktivierung",
      icon: Settings,
      renderContent: (setActiveChapter) => (
        <div>
          <p className="text-sm font-normal text-gray-600 leading-relaxed mb-4">
            Das System verfügt über eine modulare Systemsteuerung, mit der Administratoren einzelne Kernfunktionen der Plattform global ein- oder ausschalten können. Dies geschieht in den allgemeinen Einstellungen im Bereich Module. Das Deaktivieren eines Moduls blendet nicht nur die Benutzeroberfläche aus, sondern greift tief in die internen Validierungen und Berechnungen ein.
          </p>

          <h5 className="text-xs font-semibold text-gray-800 uppercase tracking-wider mt-6 mb-2">
            Veranstaltungen (Turniere &amp; Termine)
          </h5>
          <p className="text-sm font-normal text-gray-600 leading-relaxed mb-4">
            Bei Deaktivierung wird die Turnieranzeige im Hauptmenü sowie das Turnier-Widget auf dem Dashboard komplett ausgeblendet. Interne Reservierungsprüfungen ignorieren Turnier-Sperrzeiten, und Administratoren können keine neuen Veranstaltungen mehr anlegen oder editieren.
          </p>

          <h5 className="text-xs font-semibold text-gray-800 uppercase tracking-wider mt-6 mb-2">
            Gastspiele (Externe Buchungen)
          </h5>
          <p className="text-sm font-normal text-gray-600 leading-relaxed mb-4">
            Deaktiviert die Auswahl „Gäste“ im Buchungsdialog für reguläre Mitglieder. Systemseitig werden die Gastspiel-Abrechnungsmenüs für Administratoren verborgen (siehe hierzu <span onClick={() => setActiveChapter("kapitel3")} className="inline font-bold text-emerald-600 hover:underline cursor-pointer">Kapitel 3: Gastspielabrechnung</span>). Das System verhindert das Erstellen neuer Buchungen mit Gästestatus auf Code-Ebene.
          </p>

          <h5 className="text-xs font-semibold text-gray-800 uppercase tracking-wider mt-6 mb-2">
            Rangliste (Forderungsspiele)
          </h5>
          <p className="text-sm font-normal text-gray-600 leading-relaxed mb-4">
            Entfernt den Menüpunkt „Rangliste“ und schaltet die dazugehörige Pyramidendarstellung ab. Alle im Hintergrund laufenden Logiken zur Ermittlung von Ranglisten-Positionen und Forderungs-Fristen werden angehalten.
          </p>

          <h5 className="text-xs font-semibold text-gray-800 uppercase tracking-wider mt-6 mb-2">
            Arbeitseinsätze (Helferstunden)
          </h5>
          <p className="text-sm font-normal text-gray-600 leading-relaxed mb-4">
            Blendet die Fortschrittsanzeige „Meine Arbeitsstunden“ für Mitglieder auf dem Dashboard aus. Die komplette Erfassungsmaske für Helferstunden wird deaktiviert (siehe hierzu <span onClick={() => setActiveChapter("kapitel2")} className="inline font-bold text-emerald-600 hover:underline cursor-pointer">Kapitel 2: Die „Gültig Ab“-Timeline</span>).
          </p>

          <div className="bg-gray-50 border-l-4 border-green-600 p-3 my-4 rounded-r text-sm font-normal text-gray-600 leading-relaxed">
            <p className="text-xs font-bold text-green-900 uppercase tracking-wider mb-1">
              Architektonischer Hinweis
            </p>
            <p className="text-sm font-normal text-gray-600 leading-relaxed">
              Bereits in der Datenbank vorhandene Buchungen, Gastspielabrechnungen oder Arbeitseinsätze werden bei einer Deaktivierung nicht gelöscht. Sie verbleiben im Datenspeicher, sind jedoch im Frontend unsichtbar und von neuen Berechnungen ausgeschlossen, bis das jeweilige Modul reaktiviert wird.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "kapitel2",
      title: "2. Die „Gültig Ab“-Timeline für Arbeitseinsätze",
      icon: BookOpen,
      renderContent: (setActiveChapter) => (
        <div>
          <p className="text-sm font-normal text-gray-600 leading-relaxed mb-4">
            Die Verwaltung von Helferstunden (Arbeitseinsätzen) unterliegt im Vereinsrecht häufigen Anpassungen. Um zu verhindern, dass eine Änderung der jährlichen Pflichtstunden (z. B. Erhöhung von 10 auf 12 Stunden im Jahr 2026) rückwirkend die Erfüllungsgrade der vergangenen Jahre (z. B. 2025 oder 2024) verfälscht, nutzt das System eine chronologische <strong>„Gültig ab Kalenderjahr“-Timeline</strong>.
          </p>

          <div className="bg-gray-50 border-l-4 border-green-600 p-3 my-4 rounded-r text-sm font-normal text-gray-600 leading-relaxed">
            <p className="text-xs font-bold text-green-900 uppercase tracking-wider mb-1">
              Das Prinzip der historischen Interpolation
            </p>
            <p className="text-sm font-normal text-gray-600 leading-relaxed mb-2">
              Regeln werden nicht für jedes einzelne Jahr starr kopiert. Stattdessen wird bei der Abfrage der Soll-Stunden für ein bestimmtes Jahr rückwärts in der Zeit gesucht (historische Interpolation):
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm font-normal text-gray-600 leading-relaxed">
              <li>Das System prüft, ob eine explizite Regel für das gewählte Kalenderjahr (z.&nbsp;B. 2026) definiert ist.</li>
              <li>Existiert keine direkte Regel, sortiert das System alle Regeln absteigend nach dem Startjahr und sucht die erste Regel, deren Startjahr <strong>kleiner oder gleich</strong> dem Zieljahr ist (z.&nbsp;B. Startjahr 2024 gilt auch für 2025, falls kein 2025-Eintrag existiert).</li>
              <li>Gibt es überhaupt keinen Eintrag in der Timeline, greift der eingebaute <strong>Sicherheits-Fallback</strong>.</li>
            </ul>
          </div>

          <h5 className="text-xs font-semibold text-gray-800 uppercase tracking-wider mt-6 mb-2">
            System-Fallbacks (Leere Timeline)
          </h5>
          <p className="text-sm font-normal text-gray-600 leading-relaxed mb-4">
            Sollte die Timeline vom Administrator komplett gelöscht worden sein, greifen hartcodierte System-Defaults im Code, um einen Systemabsturz zu vermeiden:
          </p>
          <ul className="list-disc list-inside text-sm font-normal text-gray-600 leading-relaxed mb-4 space-y-1 bg-gray-50 p-3 rounded-xl border border-slate-100">
            <li><strong>Pflichtstunden (Soll-Stunden):</strong> 10 Stunden pro Saison</li>
            <li><strong>Ersatzgebühr pro nicht geleistete Stunde:</strong> 15,00 €</li>
          </ul>

          <p className="text-sm font-normal text-gray-600 leading-relaxed mb-4">
            Dank dieser Architektur können Administratoren bereits im Oktober des laufenden Jahres die neuen Tarife für das Folgejahr in der Timeline hinterlegen, ohne dass laufende Berechnungen oder Abrechnungen der aktuellen Saison beeinträchtigt werden (siehe hierzu <span onClick={() => setActiveChapter("kapitel4")} className="inline font-bold text-emerald-600 hover:underline cursor-pointer">Kapitel 4: Historische Datensicherheit</span>).
          </p>
        </div>
      ),
    },
    {
      id: "kapitel3",
      title: "3. Gastspielabrechnung & Tarifmechanismen",
      icon: CreditCard,
      renderContent: (setActiveChapter) => (
        <div>
          <p className="text-sm font-normal text-gray-600 leading-relaxed mb-4">
            Gastspiel-Buchungen ermöglichen es Mitgliedern, mit vereinsfremden Personen (Gästen) Plätze zu buchen. Die finanzielle Abrechnung dieser Stunden basiert auf komplexen mathematischen Tarifmodellen, die ebenfalls über eine Jahres-Timeline gesteuert werden.
          </p>

          <h5 className="text-xs font-semibold text-gray-800 uppercase tracking-wider mt-6 mb-2">
            Die Berechnungsmodi im Detail
          </h5>
          <p className="text-sm font-normal text-gray-600 leading-relaxed mb-4">
            Administratoren können in den Gastspiel-Einstellungen festlegen, wie die Platzmiete ermittelt wird. Es wird zwischen zwei wesentlichen Berechnungsmodi unterschieden:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
            <div className="p-4 bg-white border border-slate-150 rounded-xl shadow-sm">
              <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-black uppercase rounded-md mb-2">
                Modus: Platzbasis (Pauschal)
              </span>
              <p className="text-sm font-normal text-gray-600 leading-relaxed mb-2">
                Hierbei wird die Gebühr pauschal pro gebuchte Stunde erhoben, unabhängig davon, wie viele Gäste mitspielen.
              </p>
              <div className="mt-2.5 p-2 bg-slate-50 rounded-lg font-mono text-[10px] text-slate-500">
                Gebühr = Stundensatz * Buchungsdauer
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Beispiel: 2 Stunden Spielzeit bei 5 €/Std. = 10,00 € (egal ob 1, 2 oder 3 Gäste).
              </p>
            </div>

            <div className="p-4 bg-white border border-slate-150 rounded-xl shadow-sm">
              <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase rounded-md mb-2">
                Modus: Spielerbasis (Personenbezogen)
              </span>
              <p className="text-sm font-normal text-gray-600 leading-relaxed mb-2">
                Die Gebühr multipliziert sich mit der Anzahl der eingetragenen Gäste und der Spieldauer.
              </p>
              <div className="mt-2.5 p-2 bg-slate-50 rounded-lg font-mono text-[10px] text-slate-500">
                Gebühr = Stundensatz * Buchungsdauer * Gästeanzahl
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Beispiel: 2 Stunden Spielzeit mit 2 Gästen bei 5 €/Std. = 20,00 €.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 border-l-4 border-green-600 p-3 my-4 rounded-r text-sm font-normal text-gray-600 leading-relaxed">
            <p className="text-xs font-bold text-green-900 uppercase tracking-wider mb-1">
              Gastspiel-Timeline Fallback
            </p>
            <p className="text-sm font-normal text-gray-600 leading-relaxed">
              Wie bei den Arbeitseinsätzen besitzt auch das Gastspiel-Modul eine eigene Jahres-Timeline. Ist diese komplett leer, greift der System-Fallback von <strong>5,00 € pro Stunde auf PLATZBASIS</strong>.
            </p>
          </div>

          <p className="text-sm font-normal text-gray-600 leading-relaxed mb-4">
            Dank dieser Flexibilität können auch individuelle Buchungsüberschreibungen (z. B. manuell angepasste Einzelgebühren) direkt in der Buchung hinterlegt werden, um Sondervereinbarungen abzubilden (siehe hierzu <span onClick={() => setActiveChapter("kapitel4")} className="inline font-bold text-emerald-600 hover:underline cursor-pointer">Kapitel 4: Historische Datensicherheit &amp; Reporting</span>).
          </p>
        </div>
      ),
    },
    {
      id: "kapitel4",
      title: "4. Historische Datensicherheit & Reporting",
      icon: Shield,
      renderContent: (setActiveChapter) => (
        <div>
          <p className="text-sm font-normal text-gray-600 leading-relaxed mb-4">
            Ein häufiger Fehler in Vereinsdatenbanken ist das unabsichtliche Überschreiben historischer Finanzdaten. Wenn ein Kassenwart im Jahr 2026 den Gastspieltarif erhöht, dürfen sich die Einnahmen-Reports für das Jahr 2024 oder 2025 nicht verändern. Unser System verhindert dies durch ein intelligentes <strong>Immutable-Rate-Konzept</strong> (unveränderliche Tarifsicherung).
          </p>

          <h5 className="text-xs font-semibold text-gray-800 uppercase tracking-wider mt-6 mb-2">
            Wie die Datensicherheit im Hintergrund arbeitet:
          </h5>
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3 my-4 text-sm font-normal text-gray-600 leading-relaxed">
            <ol className="list-decimal list-inside space-y-2.5">
              <li>
                <strong>Buchungsspezifischer Lock (Snapshot):</strong> Bei der Erstellung einer Buchung mit Gästen ermittelt das System den zu diesem Zeitpunkt gültigen Tarif aus der Timeline (siehe <span onClick={() => setActiveChapter("kapitel3")} className="inline font-bold text-emerald-600 hover:underline cursor-pointer">Kapitel 3: Gastspielabrechnung</span>). Dieser Wert wird als fester Wert (Snapshot) direkt in das Buchungsobjekt in der Datenbank geschrieben (`guestFee`, `guestBillingMode`).
              </li>
              <li>
                <strong>Priorität bei der Report-Generierung:</strong> Wenn Finanzberichte oder Export-CSV-Dateien generiert werden, prüft das System für jeden Datensatz:
                <div className="my-2 p-2.5 bg-slate-50 rounded-lg font-mono text-[10px] text-slate-500 leading-relaxed">
                  Nutze Buchungs-Snapshot (falls vorhanden)<br />
                  ELSE &rarr; Ermittle Tarif via Jahres-Timeline interpoliert für das Buchungsdatum<br />
                  ELSE &rarr; Nutze globalen Standard-Fallback
                </div>
              </li>
              <li>
                <strong>Verhinderung von Umsatzverfälschungen:</strong> Durch diese dreistufige Hierarchie wird sichergestellt, dass auch bei komplexen, jahresübergreifenden Reports die historischen Umsätze immer exakt den Tarifen entsprechen, die am Spieltag Gültigkeit hatten.
              </li>
            </ol>
          </div>

          <div className="bg-gray-50 border-l-4 border-green-600 p-3 my-4 rounded-r text-sm font-normal text-gray-600 leading-relaxed">
            <p className="text-xs font-bold text-green-900 uppercase tracking-wider mb-1">
              Praxis-Empfehlung für Administratoren
            </p>
            <p className="text-sm font-normal text-gray-600 leading-relaxed">
              Löschen Sie niemals alte Einträge aus den Timelines der Arbeitseinsätze oder Gastspiele! Nutzen Sie stattdessen immer das Hinzufügen einer neuen Zeile für das zukünftige Jahr. Das System liest die historischen Daten automatisch aus den älteren Timeline-Einträgen aus.
            </p>
          </div>
        </div>
      ),
    },
  ];

  const activeChapter = documentationData.find((c) => c.id === activeChapterId) || documentationData[0];

  return (
    <div id="admin-documentation-root" className="w-full flex flex-col gap-6">
      {/* Top Header Card */}
      <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/60 flex items-start sm:items-center gap-4">
        <div className="p-3 bg-emerald-50 text-[var(--color-primary)] rounded-xl shrink-0">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-base font-black text-slate-900 uppercase tracking-wide">
            Administratoren-Handbuch &amp; System-Dokumentation
          </h4>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Dieses Handbuch dokumentiert die tieferen logischen Mechanismen, Berechnungsmodelle und Hintergründe unseres Vereinssystems für System-Administratoren.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Mobile dropdown selector (visible only on mobile) */}
        <div className="md:hidden w-full">
          <label htmlFor="chapter-select" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Kapitel auswählen
          </label>
          <select
            id="chapter-select"
            value={activeChapterId}
            onChange={(e) => setActiveChapterId(e.target.value)}
            className="w-full h-11 px-4 bg-white text-sm text-slate-700 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] cursor-pointer shadow-sm font-sans font-medium"
          >
            {documentationData.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.title}
              </option>
            ))}
          </select>
        </div>

        {/* Desktop Navigation (hidden on mobile) */}
        <div className="hidden md:block w-1/4 shrink-0">
          <div className="flex flex-col gap-1 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/50">
            {documentationData.map((chapter) => {
              const IsActive = chapter.id === activeChapterId;
              const ChapterIcon = chapter.icon;
              return (
                <button
                  key={chapter.id}
                  id={`desktop-tab-${chapter.id}`}
                  onClick={() => setActiveChapterId(chapter.id)}
                  className={`flex items-center gap-2.5 py-3 px-4 rounded-xl text-left text-sm font-medium transition-all ${
                    IsActive
                      ? "bg-white text-[var(--color-primary)] font-semibold shadow-sm border border-slate-200/50"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
                  }`}
                >
                  <ChapterIcon className={`w-4 h-4 shrink-0 ${IsActive ? "text-[var(--color-primary)]" : "text-slate-400"}`} />
                  <span className="truncate">{chapter.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right column (Content window) */}
        <div className="flex-1 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm min-w-0">
          {/* Main title of the active chapter, styled according to guidelines */}
          <h3 className="text-xl font-bold text-gray-950 mb-4">
            {activeChapter.title}
          </h3>

          <div className="animate-in fade-in duration-300">
            {activeChapter.renderContent(setActiveChapterId)}
          </div>
        </div>
      </div>
    </div>
  );
};
