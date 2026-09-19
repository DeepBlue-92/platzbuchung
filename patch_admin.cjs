const fs = require('fs');
const file = 'components/AdminSettings.tsx';
let code = fs.readFileSync(file, 'utf8');

const generatePasswordFunc = `
  const generateRandomPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let pwd = "";
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  };
`;

if (!code.includes('generateRandomPassword')) {
  code = code.replace('export default function AdminSettings({', generatePasswordFunc + '\nexport default function AdminSettings({');
}

const formRegex = /<label className="block text-\[10px\] font-black text-slate-500 uppercase tracking-widest mb-2">\s*Vorname[\s\S]*?placeholder="Z\.B\. tennis123"\s*\/>\s*<\/div>/g;

const newForm = `                          <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                              Benutzername <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={editingUser.name || ""}
                              onChange={(e) =>
                                setEditingUser({
                                  ...editingUser,
                                  name: e.target.value,
                                })
                              }
                              className="w-full px-2.5 border border-slate-200 rounded-xl font-bold bg-slate-50 outline-none focus:border-[var(--color-primary)] focus:bg-white transition-all text-sm py-2"
                              placeholder="Z.B. maxmustermann"
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                Vorname <span className="text-slate-300 font-normal">(optional)</span>
                              </label>
                              <input
                                type="text"
                                value={editingUser.firstName || ""}
                                onChange={(e) =>
                                  setEditingUser({
                                    ...editingUser,
                                    firstName: e.target.value,
                                  })
                                }
                                className="w-full px-2.5 border border-slate-200 rounded-xl font-bold bg-slate-50 outline-none focus:border-[var(--color-primary)] focus:bg-white transition-all text-sm py-2"
                                placeholder="Z.B. Max"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                Nachname <span className="text-slate-300 font-normal">(optional)</span>
                              </label>
                              <input
                                type="text"
                                value={editingUser.lastName || ""}
                                onChange={(e) =>
                                  setEditingUser({
                                    ...editingUser,
                                    lastName: e.target.value,
                                  })
                                }
                                className="w-full px-2.5 border border-slate-200 rounded-xl font-bold bg-slate-50 outline-none focus:border-[var(--color-primary)] focus:bg-white transition-all text-sm py-2"
                                placeholder="Z.B. Mustermann"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                              Passwort <span className="text-red-500">*</span>
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editingUser.password || ""}
                                onChange={(e) =>
                                  setEditingUser({
                                    ...editingUser,
                                    password: e.target.value,
                                    mustChangePassword: false,
                                  })
                                }
                                className="flex-1 px-2.5 border border-slate-200 rounded-xl font-bold bg-slate-50 outline-none focus:border-[var(--color-primary)] focus:bg-white transition-all text-sm py-2"
                                placeholder="Z.B. tennis123"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const pwd = generateRandomPassword();
                                  setEditingUser({
                                    ...editingUser,
                                    password: pwd,
                                    mustChangePassword: true,
                                  });
                                }}
                                className="px-3 py-2 bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold text-xs rounded-xl hover:bg-[var(--color-primary)]/20 transition-colors"
                                title="Einmal-Passwort generieren"
                              >
                                <i className="fa-solid fa-key"></i> Generieren
                              </button>
                            </div>
                            {editingUser.mustChangePassword && (
                              <p className="text-[10px] text-amber-600 mt-1 font-bold">
                                Benutzer wird beim nächsten Login zur Passwortänderung aufgefordert.
                              </p>
                            )}
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                E-Mail {!editingUser.is_placeholder_email && <span className="text-red-500">*</span>}
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!editingUser.is_placeholder_email}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setEditingUser({
                                      ...editingUser,
                                      is_placeholder_email: checked,
                                      email: checked ? "" : editingUser.email,
                                    });
                                  }}
                                  className="w-3.5 h-3.5 accent-[var(--color-primary)] rounded"
                                />
                                <span className="text-[10px] font-bold text-slate-600">
                                  Keine E-Mail vorhanden
                                </span>
                              </label>
                            </div>
                            <input
                              type="email"
                              disabled={!!editingUser.is_placeholder_email}
                              value={editingUser.is_placeholder_email ? "" : (editingUser.email || "")}
                              onChange={(e) =>
                                setEditingUser({
                                  ...editingUser,
                                  email: e.target.value,
                                  is_placeholder_email: false,
                                })
                              }
                              required={!editingUser.is_placeholder_email}
                              className={\`w-full px-2.5 border border-slate-200 rounded-xl font-bold outline-none focus:border-[var(--color-primary)] transition-all text-sm py-2 \${
                                editingUser.is_placeholder_email
                                  ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"
                                  : "bg-slate-50 focus:bg-white text-slate-800"
                              }\`}
                              placeholder={editingUser.is_placeholder_email ? "[Keine E-Mail hinterlegt]" : "Z.B. max@beispiel.de"}
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                              Telefonnummer <span className="text-slate-300 font-normal">(optional)</span>
                            </label>
                            <input
                              type="text"
                              value={editingUser.phone || ""}
                              onChange={(e) =>
                                setEditingUser({
                                  ...editingUser,
                                  phone: e.target.value,
                                })
                              }
                              className="w-full px-2.5 border border-slate-200 rounded-xl font-bold bg-slate-50 outline-none focus:border-[var(--color-primary)] focus:bg-white transition-all text-sm py-2"
                              placeholder="Z.B. +49 170 1234567"
                            />
                          </div>`;

code = code.replace(formRegex, newForm);

const handleSaveUserRegex = /password: editingUser\.password,\s*role: editingUser\.role/g;
code = code.replace(handleSaveUserRegex, `password: editingUser.password,
      mustChangePassword: !!editingUser.mustChangePassword,
      role: editingUser.role`);

const inlineRegex = /<td className="p-3 border-b border-slate-100">\s*<div className="space-y-4">[\s\S]*?placeholder="Z\.B\. tennis123"\s*\/>\s*<\/div>/g;

const newInlineForm = `<td className="p-3 border-b border-slate-100">
                                    <div className="space-y-4">
                                      <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                          Benutzername <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                          type="text"
                                          value={editingUser.name || ""}
                                          onChange={(e) =>
                                            setEditingUser({
                                              ...editingUser,
                                              name: e.target.value,
                                            })
                                          }
                                          className="w-full px-2 border-2 border-slate-200 rounded-xl font-bold bg-slate-50 outline-none focus:border-amber-500 focus:bg-white transition-all text-xs py-1.5"
                                          placeholder="Benutzername..."
                                        />
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                            Vorname
                                          </label>
                                          <input
                                            type="text"
                                            value={editingUser.firstName || ""}
                                            onChange={(e) =>
                                              setEditingUser({
                                                ...editingUser,
                                                firstName: e.target.value,
                                              })
                                            }
                                            className="w-full px-2 border-2 border-slate-200 rounded-xl font-bold bg-slate-50 outline-none focus:border-amber-500 focus:bg-white transition-all text-xs py-1.5"
                                            placeholder="Vorname..."
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                            Nachname
                                          </label>
                                          <input
                                            type="text"
                                            value={editingUser.lastName || ""}
                                            onChange={(e) =>
                                              setEditingUser({
                                                ...editingUser,
                                                lastName: e.target.value,
                                              })
                                            }
                                            className="w-full px-2 border-2 border-slate-200 rounded-xl font-bold bg-slate-50 outline-none focus:border-amber-500 focus:bg-white transition-all text-xs py-1.5"
                                            placeholder="Nachname..."
                                          />
                                        </div>
                                      </div>
                                      
                                      <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                          Passwort <span className="text-red-500">*</span>
                                        </label>
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="text"
                                            value={editingUser.password || ""}
                                            onChange={(e) =>
                                              setEditingUser({
                                                ...editingUser,
                                                password: e.target.value,
                                                mustChangePassword: false,
                                              })
                                            }
                                            className="flex-1 px-2 border-2 border-slate-200 rounded-xl font-bold bg-slate-50 outline-none focus:border-amber-500 focus:bg-white transition-all text-xs py-1.5"
                                            placeholder="Passwort..."
                                          />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const pwd = generateRandomPassword();
                                              setEditingUser({
                                                ...editingUser,
                                                password: pwd,
                                                mustChangePassword: true,
                                              });
                                            }}
                                            className="px-2 py-1.5 bg-amber-500/10 text-amber-600 font-bold text-xs rounded-xl hover:bg-amber-500/20 transition-colors"
                                            title="Einmal-Passwort generieren"
                                          >
                                            <i className="fa-solid fa-key"></i> Generieren
                                          </button>
                                        </div>
                                      </div>

                                      <div>
                                        <div className="flex justify-between items-center mb-2">
                                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            E-Mail {!editingUser.is_placeholder_email && <span className="text-red-500">*</span>}
                                          </label>
                                          <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={!!editingUser.is_placeholder_email}
                                              onChange={(e) => {
                                                const checked = e.target.checked;
                                                setEditingUser({
                                                  ...editingUser,
                                                  is_placeholder_email: checked,
                                                  email: checked ? "" : editingUser.email,
                                                });
                                              }}
                                              className="w-3.5 h-3.5 accent-amber-500 rounded"
                                            />
                                            <span className="text-[10px] font-bold text-slate-600">
                                              Keine E-Mail
                                            </span>
                                          </label>
                                        </div>
                                        <input
                                          type="email"
                                          disabled={!!editingUser.is_placeholder_email}
                                          value={editingUser.is_placeholder_email ? "" : (editingUser.email || "")}
                                          onChange={(e) =>
                                            setEditingUser({
                                              ...editingUser,
                                              email: e.target.value,
                                              is_placeholder_email: false,
                                            })
                                          }
                                          required={!editingUser.is_placeholder_email}
                                          className={\`w-full px-2 border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-amber-500 transition-all text-xs py-1.5 \${
                                            editingUser.is_placeholder_email ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-slate-50 focus:bg-white"
                                          }\`}
                                          placeholder={editingUser.is_placeholder_email ? "[Keine E-Mail hinterlegt]" : "E-Mail..."}
                                        />
                                      </div>
                                      
                                      <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                          Telefonnummer
                                        </label>
                                        <input
                                          type="text"
                                          value={editingUser.phone || ""}
                                          onChange={(e) =>
                                            setEditingUser({
                                              ...editingUser,
                                              phone: e.target.value,
                                            })
                                          }
                                          className="w-full px-2 border-2 border-slate-200 rounded-xl font-bold bg-slate-50 outline-none focus:border-amber-500 focus:bg-white transition-all text-xs py-1.5"
                                          placeholder="Telefon..."
                                        />
                                      </div>`;

code = code.replace(inlineRegex, newInlineForm);

fs.writeFileSync(file, code);
console.log("Patched AdminSettings user edit form");
