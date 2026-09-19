const fs = require('fs');
const file = 'components/Dashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

const uiSnippet = `
                    {/* Austragungsort Card */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm shrink-0">
                      <div className="h-24 w-full relative bg-slate-200 overflow-hidden">
                        <img
                          src={venuePhoto}
                          alt="Austragungsort Anlage"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent flex items-end p-2.5">
                          <div className="text-white min-w-0">
                            <div className="text-[9px] font-black uppercase tracking-widest text-amber-300 flex items-center gap-1.5 leading-none mb-1">
                              <i className="fa-solid fa-location-dot"></i>
                              Austragungsort
                            </div>
                            <div className="text-xs font-black truncate drop-shadow-sm text-white">
                              {venueClubName}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-2.5 bg-white flex flex-col gap-2">
                        <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                          <i className="fa-solid fa-map-pin text-[var(--color-primary)] text-xs shrink-0"></i>
                          <span className="truncate">{displayAddress}</span>
                        </div>
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition-colors border border-slate-200 shadow-2xs hover:text-[var(--color-primary)] cursor-pointer"
                        >
                          <i className="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
                          In Google Maps öffnen
                        </a>
                      </div>
                    </div>`;

const targetMobile = /<div style=\{\{ display: bookingTab === "normal" \? "flex" : "none", flexDirection: "column", flex: 1, overflow: "hidden" \}\}>\s*<div className="bg-white p-4 pb-4 space-y-4 overflow-y-auto flex-1 text-slate-700">/g;
const replacementMobile = `<div style={{ display: bookingTab === "normal" ? "flex" : "none", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                  <div className="bg-slate-50 p-4 pb-4 space-y-4 overflow-y-auto flex-1 text-slate-700">
                    ${uiSnippet}
`;
code = code.replace(targetMobile, replacementMobile);

const targetDesktop = /<div style=\{\{ display: bookingTab === "normal" \? "flex" : "none", flexDirection: "column", flex: 1, overflow: "hidden" \}\}>\s*<div\s*className="p-5 overflow-y-auto flex-1 bg-white"\s*style=\{\{ isolation: "isolate" \}\}\s*>/g;
const replacementDesktop = `<div style={{ display: bookingTab === "normal" ? "flex" : "none", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              <div
                className="p-5 overflow-y-auto flex-1 bg-slate-50 space-y-5"
                style={{ isolation: "isolate" }}
              >
                ${uiSnippet.replace(/bg-white rounded-xl/g, 'bg-white rounded-xl mb-5')}
`;
code = code.replace(targetDesktop, replacementDesktop);

fs.writeFileSync(file, code);
console.log("Patched Dashboard Austragungsort");
