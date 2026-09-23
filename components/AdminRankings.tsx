import React, { useState, useMemo, useCallback } from "react";
import { RankingState, User, RankingCategory } from "../types";
import { ClubSettings } from "../services/db";

interface AdminRankingsProps {
  rankings: RankingState | null;
  users: Record<string, User>;
  onUpdateRankings: (newData: RankingState) => void;
  settings?: ClubSettings;
  onUpdateSettings?: (newSettings: ClubSettings) => void;
}

const defaultRules = `* Forderungsrecht innerhalb der gesamten Kategorie.
* Gewinnt der Forderer, übernimmt er den Platz des Geforderten.
* Alle nachfolgenden Spieler rutschen einen Platz nach unten.
* Die Rangliste wird regelmäßig vom Administrator aktualisiert.`;

const AdminRankings: React.FC<AdminRankingsProps> = ({
  rankings,
  users,
  onUpdateRankings,
  settings,
  onUpdateSettings,
}) => {
  const categories = rankings?.categories || [];
  const rules = rankings?.rules || defaultRules;
  const currentViewMode: "pyramid" | "list" =
    settings?.rankingViewMode || rankings?.viewMode || "pyramid";
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    categories.length > 0 ? categories[0].id : null,
  );
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchIdx, setActiveSearchIdx] = useState<number | null>(null);

  const [newCatName, setNewCatName] = useState("");
  const [newCatLayout, setNewCatLayout] = useState<"pyramid" | "linear">(
    "pyramid",
  );
  const [newPlayerQuery, setNewPlayerQuery] = useState("");
  const [showNewPlayerSuggestions, setShowNewPlayerSuggestions] =
    useState(false);

  const [isEditingRules, setIsEditingRules] = useState(false);
  const [editedRulesText, setEditedRulesText] = useState(rules);

  const userList = useMemo(
    () =>
      (Object.values(users) as User[]).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [users],
  );

  // Keep active category in sync
  React.useEffect(() => {
    if (
      categories.length > 0 &&
      !categories.find((c) => c.id === activeCategoryId)
    ) {
      setActiveCategoryId(categories[0].id);
    }
  }, [categories, activeCategoryId]);

  const activeCategory = categories.find((c) => c.id === activeCategoryId);

  const handleUpdate = (newCategories: RankingCategory[]) => {
    onUpdateRankings({
      categories: newCategories,
      rules: rules,
      viewMode: currentViewMode,
    });
  };

  const handleSaveRules = () => {
    onUpdateRankings({
      categories: categories,
      rules: editedRulesText,
      viewMode: currentViewMode,
    });
    setIsEditingRules(false);
  };

  const handleUpdateGlobalViewMode = (mode: "pyramid" | "list") => {
    onUpdateRankings({
      categories: categories,
      rules: rules,
      viewMode: mode,
    });
    if (onUpdateSettings && settings) {
      onUpdateSettings({
        ...settings,
        rankingViewMode: mode,
      });
    }
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const newCat: RankingCategory = {
      id: Math.random().toString(36).substr(2, 9),
      name: newCatName.trim(),
      entries: [],
      layout: newCatLayout,
    };
    handleUpdate([...categories, newCat]);
    setNewCatName("");
    setActiveCategoryId(newCat.id);
  };

  const handleUpdateCategoryLayout = (layout: "pyramid" | "linear") => {
    if (!activeCategory) return;
    const newCats = [...categories];
    const catIdx = newCats.findIndex((c) => c.id === activeCategory.id);
    newCats[catIdx] = { ...newCats[catIdx], layout };
    handleUpdate(newCats);
  };

  const handleAddPlayerByName = (name: string) => {
    if (!activeCategory || !name.trim()) return;
    const newCats = [...categories];
    const catIdx = newCats.findIndex((c) => c.id === activeCategory.id);
    newCats[catIdx].entries.push({
      id: Math.random().toString(36).substr(2, 9),
      userName: name.trim(),
    });
    handleUpdate(newCats);
    setNewPlayerQuery("");
    setShowNewPlayerSuggestions(false);
  };

  const handleDeleteCategory = (id: string) => {
    if (
      confirm(
        "Möchtest du diese Rangliste und alle ihre Platzierungen wirklich löschen?",
      )
    ) {
      handleUpdate(categories.filter((c) => c.id !== id));
    }
  };

  const moveCategory = (idx: number, direction: "up" | "down") => {
    const newCats = [...categories];
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx >= 0 && targetIdx < newCats.length) {
      const temp = newCats[idx];
      newCats[idx] = newCats[targetIdx];
      newCats[targetIdx] = temp;
      handleUpdate(newCats);
    }
  };

  const handleAddEntry = () => {
    if (!activeCategory) return;
    const newCats = [...categories];
    const catIdx = newCats.findIndex((c) => c.id === activeCategory.id);
    newCats[catIdx].entries.push({
      id: Math.random().toString(36).substr(2, 9),
      userName: "Gastspieler",
    });
    handleUpdate(newCats);
  };

  const handleRemoveEntry = (idx: number) => {
    if (!activeCategory) return;
    const newCats = [...categories];
    const catIdx = newCats.findIndex((c) => c.id === activeCategory.id);
    newCats[catIdx].entries.splice(idx, 1);
    handleUpdate(newCats);
  };

  const moveEntry = (idx: number, direction: "up" | "down") => {
    if (!activeCategory) return;
    const newCats = [...categories];
    const catIdx = newCats.findIndex((c) => c.id === activeCategory.id);
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    const entries = newCats[catIdx].entries;
    if (targetIdx >= 0 && targetIdx < entries.length) {
      const temp = entries[idx];
      entries[idx] = entries[targetIdx];
      entries[targetIdx] = temp;
      handleUpdate(newCats);
    }
  };

  const handleUpdateEntryName = useCallback(
    (idx: number, newName: string) => {
      if (!activeCategory) return;
      const newCats = [...categories];
      const catIdx = newCats.findIndex((c) => c.id === activeCategory.id);
      newCats[catIdx].entries[idx] = {
        ...newCats[catIdx].entries[idx],
        userName: newName,
      };
      handleUpdate(newCats);
      setEditingIdx(null);
      setActiveSearchIdx(null);
      setSearchQuery("");
    },
    [categories, activeCategory, handleUpdate],
  );

  const getFullName = (u: User) => {
    if (u.klarname) return u.klarname;
    if (u.firstName || u.lastName) {
      return `${u.firstName || ""} ${u.lastName || ""}`.trim();
    }
    return u.name;
  };

  const getUserDisplayName = (rawName: string): string => {
    if (!rawName) return "";
    const trimmed = rawName.trim();
    if (users[trimmed]) {
      const u = users[trimmed];
      return u.klarname || `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.name;
    }
    const foundUser = (Object.values(users) as User[]).find((u) => {
      const full = `${u.firstName || ""} ${u.lastName || ""}`.trim();
      const reverseFull = `${u.lastName || ""}, ${u.firstName || ""}`.trim().replace(/^, |,$/, "");
      return (
        u.id === trimmed ||
        u.name.toLowerCase() === trimmed.toLowerCase() ||
        (u.klarname && u.klarname.toLowerCase() === trimmed.toLowerCase()) ||
        (full && full.toLowerCase() === trimmed.toLowerCase()) ||
        (reverseFull && reverseFull.toLowerCase() === trimmed.toLowerCase())
      );
    });
    if (foundUser) {
      return foundUser.klarname || `${foundUser.firstName || ""} ${foundUser.lastName || ""}`.trim() || foundUser.name;
    }
    return rawName;
  };

  const activeEntryNames = useMemo(() => {
    if (!activeCategory) return [];
    return activeCategory.entries.map((e) => getUserDisplayName(e.userName).toLowerCase());
  }, [activeCategory, users]);

  const suggestions = useMemo(() => {
    const q = searchQuery.toLowerCase();

    // Base filter: not already in list or matches exactly what we are currently searching
    const filteredUserList = userList.filter((u) => {
      const name = getFullName(u);
      return (
        !activeEntryNames.includes(name.toLowerCase()) ||
        name.toLowerCase() === q
      );
    });

    if (!q) return filteredUserList.slice(0, 5).map((u) => getFullName(u));
    const matches = filteredUserList
      .filter((u) => getFullName(u).toLowerCase().includes(q))
      .map((u) => getFullName(u))
      .slice(0, 5);
    const results = "gastspieler".includes(q)
      ? ["Gastspieler", ...matches]
      : matches;
    return results.slice(0, 5);
  }, [searchQuery, userList, activeEntryNames]);

  const newPlayerSuggestions = useMemo(() => {
    const q = newPlayerQuery.toLowerCase().trim();
    if (!q) return [];
    const matches = userList
      .filter((u) => {
        const name = getFullName(u);
        return (
          name.toLowerCase().includes(q) &&
          !activeEntryNames.includes(name.toLowerCase())
        );
      })
      .map((u) => getFullName(u));
    if ("gastspieler".includes(q) && !matches.includes("Gastspieler")) {
      matches.unshift("Gastspieler");
    }
    return matches.slice(0, 5);
  }, [newPlayerQuery, userList, activeEntryNames]);

  return (
    <div className="space-y-4 lg:space-y-6 animate-in fade-in duration-300">
      {/* Global View Mode Setting */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
            <i className="fa-solid fa-eye text-[var(--color-primary)]"></i>
            Globales Ansichtsformat der Rangliste
          </h4>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            Bestimmt die Darstellung für alle Mitglieder (Pyramide oder Tabelle). Der manuelle Ansichts-Schalter auf der Mitgliederseite ist deaktiviert.
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => handleUpdateGlobalViewMode("pyramid")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              currentViewMode === "pyramid"
                ? "bg-white text-slate-900 shadow-xs font-black"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <i className="fa-solid fa-network-wired text-[11px]"></i>
            Pyramide (Tannenbaum)
          </button>
          <button
            type="button"
            onClick={() => handleUpdateGlobalViewMode("list")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              currentViewMode === "list"
                ? "bg-white text-slate-900 shadow-xs font-black"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <i className="fa-solid fa-list-ol text-[11px]"></i>
            Tabelle (Liste)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
        {/* Category Management */}
        <div className="bg-slate-50 p-6 sm:p-8 rounded-[1rem] border border-slate-100 shadow-sm">
          <h3 className="text-sm font-black text-[var(--color-primary)] uppercase flex items-center gap-2 mb-4">
            <i className="fa-solid fa-list-ol"></i> Verfügbare Ranglisten
          </h3>

          <div className="flex flex-col gap-2 mb-4">
            <input 
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Name (z.B. Herren, Damen)"
              className="w-full px-2.5 rounded-xl border border-slate-300 text-xs bg-white py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
            />
            <div className="flex gap-2">
              <select 
                value={newCatLayout}
                onChange={(e) =>
                  setNewCatLayout(e.target.value as "pyramid" | "linear")
                }
                className="flex-1 px-2.5 rounded-xl border border-slate-300 text-xs bg-white py-2 font-sans font-medium"
              >
                <option value="pyramid">Tannenbaum (Pyramide)</option>
                <option value="linear">Lineare Liste</option>
              </select>
              <button
                onClick={handleAddCategory}
                className="bg-[var(--color-primary)] text-white px-4 rounded-xl uppercase hover:bg-[var(--color-accent)] transition-colors active:scale-95 shrink-0 py-2.5 text-sm font-medium"
              >
                Hinzufügen
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {categories.map((cat, idx) => (
              <div
                key={cat.id}
                className={`flex justify-between items-center bg-white p-3 rounded-2xl border cursor-pointer overflow-hidden group transition-all duration-200 ${activeCategoryId === cat.id ? "border-l-4 border-l-[var(--color-primary)] border-t-slate-200 border-r-slate-200 border-b-slate-200 bg-slate-50 shadow-sm" : "border-slate-200 hover:border-slate-300"}`}
                onClick={() => setActiveCategoryId(cat.id)}
              >
                <div className="flex items-center gap-3 w-full min-w-0">
                  <span
                    className={`text-white text-xs font-bold px-2 py-1 rounded-full uppercase shrink-0 ${activeCategoryId === cat.id ? "bg-[var(--color-primary)]" : "bg-slate-300"}`}
                  >
                    {cat.entries.length} Sp.
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span
                      className={`font-black text-xs md:text-sm uppercase truncate ${activeCategoryId === cat.id ? "text-[var(--color-primary)]" : "text-slate-700"}`}
                    >
                      {cat.name}
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase ${activeCategoryId === cat.id ? "text-[var(--color-primary)]/70" : "text-slate-400"}`}
                    >
                      {(cat.layout || "pyramid") === "pyramid"
                        ? "Tannenbaum"
                        : "Lineare Liste"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center shrink-0">
                  <button
                    disabled={idx === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveCategory(idx, "up");
                    }}
                    className="w-8 h-8 rounded-lg text-slate-400 hover:text-[var(--color-primary)] disabled:opacity-20 active:scale-90"
                  >
                    <i className="fa-solid fa-arrow-up text-xs"></i>
                  </button>
                  <button
                    disabled={idx === categories.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveCategory(idx, "down");
                    }}
                    className="w-8 h-8 rounded-lg text-slate-400 hover:text-[var(--color-primary)] disabled:opacity-20 active:scale-90"
                  >
                    <i className="fa-solid fa-arrow-down text-xs"></i>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCategory(cat.id);
                    }}
                    className="w-8 h-8 rounded-lg text-red-300 hover:text-red-500 active:scale-90"
                  >
                    <i className="fa-solid fa-trash text-xs"></i>
                  </button>
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <div className="text-center text-slate-400 text-xs font-bold py-4">
                Noch keine Ranglisten erstellt.
              </div>
            )}
          </div>
        </div>

        {/* Player Management */}
        <div className="bg-slate-50 p-6 sm:p-8 rounded-[1rem] border border-slate-100 shadow-sm flex flex-col h-full">
          {activeCategory ? (
            <>
              <h3 className="text-sm font-black text-[var(--color-primary)] uppercase flex items-center justify-between mb-4">
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-users"></i> Spieler:{" "}
                  {activeCategory.name}
                </span>
              </h3>

              {/* Meta & Configuration Row */}
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <div className="flex-1 flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    Layout:
                  </span>
                  <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                    <button
                      onClick={() => handleUpdateCategoryLayout("pyramid")}
                      className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${
                        (activeCategory.layout || "pyramid") === "pyramid"
                          ? "bg-slate-700 text-white shadow-sm"
                          : "text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      Tannenbaum
                    </button>
                    <button
                      onClick={() => handleUpdateCategoryLayout("linear")}
                      className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${
                        activeCategory.layout === "linear"
                          ? "bg-slate-700 text-white shadow-sm"
                          : "text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      Lineare Liste
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    Regeln:
                  </span>
                  {!isEditingRules && (
                    <button
                      onClick={() => setIsEditingRules(true)}
                      className="px-2 py-1 rounded-md border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all font-black uppercase text-[9px] flex items-center gap-1.5 text-slate-600 active:scale-95"
                    >
                      <i className="fa-solid fa-pen-to-square text-[var(--color-accent)]"></i>{" "}
                      Bearbeiten
                    </button>
                  )}
                </div>
              </div>

              {isEditingRules && (
                <div className="mb-4 bg-white p-3 rounded-2xl border border-slate-200 space-y-3">
                  <textarea
                    className="w-full min-h-[140px] border border-slate-250 rounded-xl outline-none focus:border-[var(--color-primary)] text-slate-800 bg-slate-50/50 resize-y p-2 text-sm placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                    value={editedRulesText}
                    onChange={(e) => setEditedRulesText(e.target.value)}
                    placeholder="Trage hier die Regeln ein. Verwende * am Zeilenanfang für Listenpunkte..."
                  />
                  <div className="flex items-center justify-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditedRulesText(rules);
                        setIsEditingRules(false);
                      }}
                      className="px-4 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black uppercase tracking-wider text-[10px] transition-colors"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveRules}
                      className="px-4 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-white rounded-xl uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm py-2.5 text-sm font-medium"
                    >
                      <i className="fa-solid fa-check text-white/80"></i>{" "}
                      Speichern
                    </button>
                  </div>
                </div>
              )}

              {/* Search and Add Player directly */}
              <div className="mb-4 relative z-[180]">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input className="w-full rounded-xl border border-slate-300 bg-white p-2 text-sm placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                      placeholder="Spielername suchen..."
                      value={newPlayerQuery}
                      onChange={(e) => {
                        setNewPlayerQuery(e.target.value);
                        setShowNewPlayerSuggestions(true);
                      }}
                      onFocus={() => setShowNewPlayerSuggestions(true)}
                      onBlur={() =>
                        setTimeout(
                          () => setShowNewPlayerSuggestions(false),
                          250,
                        )
                      }
                    />
                    {showNewPlayerSuggestions && newPlayerQuery && (
                      <div className="absolute z-[200] w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-56 overflow-y-auto no-scrollbar">
                        {newPlayerSuggestions.length > 0 ? (
                          newPlayerSuggestions.map((s) => (
                            <button
                              key={s}
                              className="w-full text-left px-3 hover:bg-slate-100 text-slate-700 border-b last:border-0 py-2.5 text-sm font-medium"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleAddPlayerByName(s);
                              }}
                            >
                              {s}
                            </button>
                          ))
                        ) : (
                          <div className="p-3 text-center text-slate-400 text-[10px] font-bold">
                            Kein genauer Treffer.
                            <button
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleAddPlayerByName(newPlayerQuery.trim());
                              }}
                              className="mt-2 w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-center font-black uppercase text-[var(--color-primary)] rounded-lg text-[9px]"
                            >
                              "{newPlayerQuery.trim()}" hinzufügen
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      if (newPlayerQuery.trim()) {
                        handleAddPlayerByName(newPlayerQuery.trim());
                      } else {
                        handleAddPlayerByName("Gastspieler");
                      }
                    }}
                    className="bg-[var(--color-primary)] text-white px-3 py-2 rounded-xl font-black uppercase text-[10px] hover:bg-[var(--color-accent)] transition-colors active:scale-95 shrink-0"
                  >
                    Hinzufügen
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-2 scrollbar-hide flex-1">
                {activeCategory.entries.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className="flex relative items-center gap-2 bg-white px-2 py-1.5 rounded-lg border border-slate-200 group transition-all"
                  >
                    <div className="w-5 h-5 bg-slate-100 rounded-md flex items-center justify-center font-black text-[var(--color-primary)] text-[9px] shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-[120px] relative">
                      {editingIdx === idx ? (
                        <div className="relative z-[150]">
                          <input 
                            autoFocus
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                              setSearchQuery(e.target.value);
                              setActiveSearchIdx(idx);
                            }}
                            onFocus={() => setActiveSearchIdx(idx)}
                            onBlur={() =>
                              setTimeout(() => {
                                if (activeSearchIdx === idx) {
                                  setActiveSearchIdx(null);
                                  setEditingIdx(null);
                                  setSearchQuery("");
                                }
                              }, 250)
                            }
                            className="w-full px-1 border-2 border-[var(--color-accent)] rounded-md bg-white text-slate-900 text-[10px] shadow-sm outline-none relative z-[151] py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                            placeholder="Suchen..."
                          />
                          {activeSearchIdx === idx && (
                            <div className="absolute z-[200] w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
                              {suggestions.length > 0 ? (
                                suggestions.map((s) => (
                                  <button
                                    key={s}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleUpdateEntryName(idx, s);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 font-bold text-slate-700 border-b last:border-0"
                                  >
                                    {s}
                                  </button>
                                ))
                              ) : (
                                <div className="p-2 text-center text-slate-400 text-[10px] font-bold">
                                  Keine Treffer
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingIdx(idx);
                            setSearchQuery("");
                            setActiveSearchIdx(idx);
                          }}
                          className="text-left font-bold text-[10px] text-slate-700 hover:text-[var(--color-accent)] transition-colors w-full p-0.5 rounded-md hover:bg-slate-50 truncate"
                        >
                          {getUserDisplayName(entry.userName)}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center shrink-0 justify-end gap-0.5">
                      <button
                        disabled={idx === 0}
                        onClick={() => moveEntry(idx, "up")}
                        className="w-5 h-5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-[var(--color-primary)] disabled:opacity-20 active:scale-90"
                      >
                        <i className="fa-solid fa-arrow-up text-[9px]"></i>
                      </button>
                      <button
                        disabled={idx === activeCategory.entries.length - 1}
                        onClick={() => moveEntry(idx, "down")}
                        className="w-5 h-5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-[var(--color-primary)] disabled:opacity-20 active:scale-90"
                      >
                        <i className="fa-solid fa-arrow-down text-[9px]"></i>
                      </button>
                      <button
                        onClick={() => handleRemoveEntry(idx)}
                        className="w-5 h-5 rounded hover:bg-slate-100 flex items-center justify-center text-red-300 hover:text-red-500 active:scale-90 ml-0.5"
                      >
                        <i className="fa-solid fa-trash text-[9px]"></i>
                      </button>
                    </div>
                  </div>
                ))}
                {activeCategory.entries.length === 0 && (
                  <div className="text-center text-slate-400 text-xs font-bold py-4">
                    Noch keine Spieler in dieser Liste.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 font-bold text-xs">
              Bitte zuerst eine Kategorie links erstellen.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminRankings;
