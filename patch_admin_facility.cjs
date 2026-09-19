const fs = require('fs');
const file = 'components/AdminSettings.tsx';
let code = fs.readFileSync(file, 'utf8');

const target = /placeholder="z\. B\. Ergolding"\s*className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium bg-white focus:border-\[var\(--color-primary\)\] outline-none transition-all text-xs"\s*\/>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/g;

const replacement = `placeholder="z. B. Ergolding"
                                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium bg-white focus:border-[var(--color-primary)] outline-none transition-all text-xs"
                                />
                              </div>
                            </div>
                            
                            <div className="pt-2">
                              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Anlagen-Foto (Für Liga & Buchung)
                              </span>
                              <div className="flex flex-col gap-2">
                                {(customFacilityPhotoUrl || headerLogoUrl) ? (
                                  <div className="relative h-20 w-32 rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
                                    <img 
                                      src={customFacilityPhotoUrl || headerLogoUrl} 
                                      alt="Anlagen Vorschau" 
                                      className="w-full h-full object-cover"
                                    />
                                    {customFacilityPhotoUrl && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setFacilityPhotoUrl("");
                                          setCustomFacilityPhotoUrl("");
                                        }}
                                        className="absolute top-1 right-1 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-red-500 shadow-sm hover:bg-red-50 transition-colors"
                                        title="Anlagen-Foto entfernen"
                                      >
                                        <i className="fa-solid fa-xmark text-xs"></i>
                                      </button>
                                    )}
                                  </div>
                                ) : null}
                                <div className="flex flex-col gap-2 relative">
                                  <input
                                    type="text"
                                    value={customFacilityPhotoUrl}
                                    onChange={(e) => {
                                      setFacilityPhotoUrl(e.target.value);
                                      setCustomFacilityPhotoUrl(e.target.value);
                                    }}
                                    placeholder="Bild-URL einfügen (optional)"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium bg-white focus:border-[var(--color-primary)] outline-none transition-all text-xs"
                                  />
                                  <label className="cursor-pointer flex items-center justify-center gap-2 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all border border-slate-200 active:scale-95">
                                    <i className="fa-solid fa-upload"></i> Foto hochladen
                                    <input
                                      type="file"
                                      accept="image/jpeg,image/png,image/webp"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleImageUpload(file, "facility");
                                      }}
                                    />
                                  </label>
                                  <p className="text-[10px] text-slate-400 leading-tight">
                                    Optional. Wenn leer, wird das Logo/Banner als Fallback für die Austragungsort-Karte genutzt.
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                          </div>
                        </div>`;

code = code.replace(target, replacement);

fs.writeFileSync(file, code);
console.log("Patched AdminSettings facilityPhotoUrl");
