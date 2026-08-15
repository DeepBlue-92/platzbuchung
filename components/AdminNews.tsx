import React, { useState } from "react";

interface AdminNewsProps {
  currentNews: string;
  onUpdateNews: (news: string) => void;
}

const AdminNews: React.FC<AdminNewsProps> = ({ currentNews, onUpdateNews }) => {
  const [newsInput, setNewsInput] = useState(currentNews);

  const handleSave = () => {
    onUpdateNews(newsInput);
  };

  const handleClear = () => {
    setNewsInput("");
    onUpdateNews("");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-6 mb-8">
          <div className="w-16 h-16 bg-[var(--color-accent)] rounded-2xl flex items-center justify-center shadow-lg shadow-[var(--color-accent)]/20">
            <i className="fa-solid fa-bullhorn text-white text-2xl"></i>
          </div>
          <div>
            <h2 className="text-3xl font-black text-[var(--color-primary)] uppercase tracking-tighter">
              News-Zentrale
            </h2>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em]">
              Kommunikation für alle Mitglieder
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest ml-1">
              Aktuelle Meldung
            </label>
            <textarea
              value={newsInput}
              onChange={(e) => setNewsInput(e.target.value)}
              placeholder="Z.B. Die Anmeldung für die Vereinsmeisterschaft läuft!"
              className="w-full p-6 rounded-3xl bg-slate-50 border-2 border-slate-200 text-[var(--color-primary)] font-bold text-lg outline-none focus:border-[var(--color-accent)] shadow-sm min-h-[150px] resize-none transition-all"
            />
          </div>

          <div className="flex flex-wrap gap-4 pt-2">
            <button
              onClick={handleSave}
              className="flex-1 min-w-[200px] bg-[var(--color-primary)] hover:bg-black text-[var(--color-accent-3)] rounded-2xl uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 py-2.5 text-sm font-medium"
            >
              <i className="fa-solid fa-floppy-disk"></i>
              Meldung Veröffentlichen
            </button>
            <button
              onClick={handleClear}
              className="px-8 bg-white border-2 border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-200 rounded-2xl uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3 py-2.5 text-sm font-medium"
            >
              <i className="fa-solid fa-trash-can"></i>
              Löschen
            </button>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      <div className="bg-slate-100 p-8 rounded-[1.25rem] border-2 border-dashed border-slate-300">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-6 text-center">
          Vorschau der Anzeige
        </h3>
        <div className="bg-[var(--color-primary)] rounded-2xl overflow-hidden shadow-sm border border-slate-200/80">
          {newsInput.trim() ? (
            <div className="bg-[var(--color-accent)] py-3 px-6 text-center">
              <p className="text-white text-xs font-black uppercase tracking-widest">
                <i className="fa-solid fa-bullhorn mr-3"></i> {newsInput}
              </p>
            </div>
          ) : (
            <div className="py-8 text-center bg-slate-200/50">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest italic">
                Keine aktive Meldung
              </p>
            </div>
          )}
          <div className="h-12 bg-white/5 flex items-center px-6">
            <div className="h-2 w-24 bg-white/20 rounded-full"></div>
          </div>
        </div>
        <p className="mt-4 text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">
          Die News wird sofort nach dem Speichern für alle Benutzer im Header
          sichtbar.
        </p>
      </div>
    </div>
  );
};

export default AdminNews;
