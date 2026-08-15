import React, { useState, useEffect } from "react";
import { listenToSystemUpdates, ClubSettings } from "../services/db";
import { RichTextRenderer } from "./RichText";

export default function AdminChangelog({
  settings,
}: {
  settings: ClubSettings;
}) {
  const [changelogData, setChangelogData] = useState<{
    text: string;
    lastUpdated?: string;
    updatedBy?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  useEffect(() => {
    const unsub = listenToSystemUpdates((updates) => {
      setChangelogData(updates);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const pages = React.useMemo(() => {
    if (!changelogData?.text) return [];
    const text = changelogData.text;
    const paragraphs = text.split("\n\n");
    const out: string[] = [];
    let current = "";
    for (const p of paragraphs) {
      if (current.length + p.length > 1500 && current.length > 0) {
        // Only break on H1 or H2 if possible, or if it's getting really long
        if (
          p.startsWith("# ") ||
          p.startsWith("## ") ||
          current.length > 2500
        ) {
          out.push(current);
          current = p;
          continue;
        }
      }
      current = current ? current + "\n\n" + p : p;
      if (current.length > 3000) {
        out.push(current);
        current = "";
      }
    }
    if (current) out.push(current);
    return out;
  }, [changelogData?.text]);

  // Handle out of bounds if data changes
  useEffect(() => {
    if (currentPageIndex >= pages.length && pages.length > 0) {
      setCurrentPageIndex(pages.length - 1);
    }
  }, [pages.length, currentPageIndex]);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* Banner / Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-sm relative overflow-hidden transition-all duration-300">
        <div className="relative z-10">
          <div className="space-y-1">
            <h1 className="text-xl font-bold uppercase tracking-tight text-[var(--color-primary)] flex items-center gap-2">
              <i className="fa-solid fa-clock-rotate-left"></i> System-Updates &
              Changelog
            </h1>
            <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-none">
              Hier findest du alle zentralen Kern-Updates, neue Features und
              Korrekturen der Plattform. Dieses Protokoll wird laufend vom
              System-Admin gepflegt.
            </p>
          </div>
        </div>
      </div>

      {/* Main Changelog Content */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <i className="fa-solid fa-circle-notch fa-spin text-2xl text-slate-300 mb-3" />
            <p className="text-xs text-slate-400 font-bold tracking-wider uppercase">
              Lade Systemänderungen...
            </p>
          </div>
        ) : pages.length > 0 ? (
          <div className="flex flex-col space-y-6">
            <div className="select-text prose max-w-none">
              <RichTextRenderer text={pages[currentPageIndex] || ""} />
            </div>

            {pages.length > 1 && (
              <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                <button
                  onClick={() =>
                    setCurrentPageIndex(Math.max(0, currentPageIndex - 1))
                  }
                  disabled={currentPageIndex === 0}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <i className="fa-solid fa-arrow-left mr-2"></i> Neuere
                </button>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Seite {currentPageIndex + 1} von {pages.length}
                </div>
                <button
                  onClick={() =>
                    setCurrentPageIndex(
                      Math.min(pages.length - 1, currentPageIndex + 1),
                    )
                  }
                  disabled={currentPageIndex === pages.length - 1}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Ältere <i className="fa-solid fa-arrow-right ml-2"></i>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-16 text-center select-none">
            <div className="w-16 h-16 bg-slate-50 border border-slate-200 border-dashed rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-feather-pointed text-xl text-slate-300" />
            </div>
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-tight">
              Keine Changelogs eingetragen
            </h3>
            <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto mt-1.5 leading-relaxed">
              Es sind momentan noch keine globalen Feature-Updates oder
              Releasenotizen im System-Journal vermerkt.
            </p>
          </div>
        )}
      </div>

      {/* Admin Information Footnote */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 border border-slate-200">
          <i className="fa-solid fa-bullhorn text-xs" />
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
          <strong className="text-slate-800">
            Fragen oder Feedback zu neuen Features?
          </strong>{" "}
          Dieses System wird kontinuierlich weiterentwickelt. Bei Wünschen zu
          weiteren Regularien oder Layout-Vorlagen für deinen Verein wende dich
          bitte wie gewohnt direkt an den System-Support.
        </p>
      </div>
    </div>
  );
}
