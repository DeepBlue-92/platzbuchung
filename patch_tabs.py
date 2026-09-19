import re

with open('./components/SuperAdminDashboard.tsx', 'r') as f:
    content = f.read()

new_tabs = """          <button
            onClick={() => setActiveTab("allgemein")}
            className={`flex-1 shrink-0 px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "allgemein"
                ? "bg-[#1b4332] text-white shadow-sm border border-[#1b4332]"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"
            }`}
          >
            <i className="fa-solid fa-table-list text-[11px]"></i>
            Allgemein
          </button>
          <button
            onClick={() => setActiveTab("accounts")}
            className={`flex-1 shrink-0 px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "accounts"
                ? "bg-[#1b4332] text-white shadow-sm border border-[#1b4332]"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"
            }`}
          >
            <i className="fa-solid fa-user-shield text-[11px]"></i>
            Benutzer
          </button>
          <button
            onClick={() => setActiveTab("duplicates")}
            className={`flex-1 shrink-0 px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "duplicates"
                ? "bg-[#1b4332] text-white shadow-sm border border-[#1b4332]"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"
            }`}
          >
            <i className="fa-solid fa-users text-[11px]"></i>
            Dubletten
            {allSystemDuplicates.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[9px] font-black rounded-full bg-amber-500 text-white">
                {allSystemDuplicates.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("hobbyliga")}
            className={`flex-1 shrink-0 px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "hobbyliga"
                ? "bg-[#1b4332] text-white shadow-sm border border-[#1b4332]"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"
            }`}
          >
            <i className="fa-solid fa-trophy text-[11px]"></i>
            Liga
          </button>
          <button
            onClick={() => setActiveTab("recycle-bin")}
            className={`flex-1 shrink-0 px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "recycle-bin"
                ? "bg-[#1b4332] text-white shadow-sm border border-[#1b4332]"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"
            }`}
          >
            <i className="fa-solid fa-trash-can text-[11px]"></i>
            Papierkorb
          </button>
          <button
            onClick={() => setActiveTab("changelog")}
            className={`flex-1 shrink-0 px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "changelog"
                ? "bg-[#1b4332] text-white shadow-sm border border-[#1b4332]"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"
            }`}
          >
            <i className="fa-solid fa-file-waveform text-[11px]"></i>
            Changelog
          </button>
          <button
            onClick={() => setActiveTab("backup")}
            className={`flex-1 shrink-0 px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "backup"
                ? "bg-[#1b4332] text-white shadow-sm border border-[#1b4332]"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"
            }`}
          >
            <i className="fa-solid fa-clock-rotate-left text-[11px]"></i>
            Backup
          </button>"""

pattern = re.compile(r'          <button\n            onClick=\{\(\) => setActiveTab\("allgemein"\)\}.*?Benutzer\n          </button>', re.DOTALL)
new_content = pattern.sub(new_tabs, content)

with open('./components/SuperAdminDashboard.tsx', 'w') as f:
    f.write(new_content)

print("Replaced!")
