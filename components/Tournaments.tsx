import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { PartyPopper, Plus } from "lucide-react";
import { Tournament, User, Role } from "../types";

interface TournamentsProps {
  tournaments: Tournament[];
  users: Record<string, User>;
  currentUser: User;
  onToggleRegistration: (
    tournamentId: string,
    playerName?: string,
    comment?: string,
  ) => void;
  onAddTournament: (
    tournament: Omit<Tournament, "id" | "participants">,
  ) => void;
  onDeleteTournament: (tournamentId: string) => void;
  onUpdateTournament?: (id: string, updates: Partial<Tournament>) => void;
  highlightEventId?: string | null;
}

const Tournaments: React.FC<TournamentsProps> = ({
  tournaments,
  users,
  currentUser,
  onToggleRegistration,
  onAddTournament,
  onDeleteTournament,
  onUpdateTournament,
  highlightEventId,
}) => {
  const [isSliderOpen, setIsSliderOpen] = useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (highlightEventId) {
      setTimeout(() => {
        const element = document.getElementById(`event-${highlightEventId}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 500);
    }
  }, [highlightEventId]);

  const handleCopyLink = () => {
    if (!editingTournamentId) return;
    const eventLink = `${window.location.origin}/#/events/${editingTournamentId}`;
    navigator.clipboard.writeText(eventLink)
      .then(() => {
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      })
      .catch((err) => {
        console.error("Fehler beim Kopieren des Links:", err);
      });
  };
  const [playerSearch, setPlayerSearch] = useState<{
    tournamentId: string;
    query: string;
  }>({ tournamentId: "", query: "" });
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>(
    {},
  );
  const [expandedMobile, setExpandedMobile] = useState<Record<string, boolean>>(
    {},
  );

  const [formData, setFormData] = useState({
    title: "",
    date: "",
    startTime: "",
    endTime: "",
    description: "",
    hideExpired: false,
    allowComment: false,
    maxParticipants: "",
    isRegistrationBlocked: false,
  });

  const [showPastEvents, setShowPastEvents] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [auditModalId, setAuditModalId] = useState<string | null>(null);
  const [isAuditAnimatingIn, setIsAuditAnimatingIn] = useState(false);
  const [isAuditClosing, setIsAuditClosing] = useState(false);

  const handleOpenAudit = (tournamentId: string) => {
    setAuditModalId(tournamentId);
    setIsAuditAnimatingIn(false);
    setTimeout(() => setIsAuditAnimatingIn(true), 10);
    setIsAuditClosing(false);
  };

  const handleCloseAudit = () => {
    setIsAuditClosing(true);
    setTimeout(() => {
      setAuditModalId(null);
      setIsAuditAnimatingIn(false);
      setIsAuditClosing(false);
    }, 250);
  };

  const handleOpenSlider = (tournament?: Tournament) => {
    if (tournament) {
      setEditingTournamentId(tournament.id);
      setFormData({
        title: tournament.title || "",
        date: tournament.date || "",
        startTime: tournament.startTime || "",
        endTime: tournament.endTime || "",
        description: tournament.description || "",
        hideExpired: tournament.hideExpired ?? false,
        allowComment: tournament.allowComment ?? false,
        maxParticipants: tournament.maxParticipants
          ? tournament.maxParticipants.toString()
          : "",
        isRegistrationBlocked: tournament.isRegistrationBlocked ?? false,
      });
    } else {
      setEditingTournamentId(null);
      setFormData({
        title: "",
        date: "",
        startTime: "",
        endTime: "",
        description: "",
        hideExpired: false,
        allowComment: false,
        maxParticipants: "",
        isRegistrationBlocked: false,
      });
    }

    setIsSliderOpen(true);
    setIsAnimatingIn(false);
    setTimeout(() => setIsAnimatingIn(true), 10);
    setIsClosing(false);
    // Scroll to top on mobile maybe
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCloseSlider = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsSliderOpen(false);
      setIsAnimatingIn(false);
      setIsClosing(false);
      setEditingTournamentId(null);
      setFormData({
        title: "",
        date: "",
        startTime: "",
        endTime: "",
        description: "",
        hideExpired: false,
        allowComment: false,
        maxParticipants: "",
        isRegistrationBlocked: false,
      });
    }, 250);
  };

  const allUsers = Object.values(users) as User[];
  const isAdmin = currentUser.role === Role.ADMIN || currentUser.hauptAdmin === true;

  const getUserDisplayName = (nameOrId: string) => {
    if (!nameOrId) return "Unbekannt";
    const foundUser = allUsers.find(
      (u) =>
        u.name?.toLowerCase() === nameOrId.toLowerCase() || u.id === nameOrId,
    );
    if (foundUser) {
      if (foundUser.klarname) return foundUser.klarname;
      if (foundUser.firstName || foundUser.lastName) {
        return `${foundUser.firstName || ""} ${foundUser.lastName || ""}`.trim();
      }
      return foundUser.name;
    }
    return nameOrId;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    const tournamentDetails = {
      title: formData.title.trim(),
      date: formData.date || null,
      startTime: formData.startTime || null,
      endTime: formData.endTime || null,
      description: formData.description.trim() || null,
      hideExpired: formData.hideExpired,
      allowComment: formData.allowComment,
      maxParticipants: formData.maxParticipants
        ? parseInt(formData.maxParticipants, 10)
        : null,
      isRegistrationBlocked: formData.isRegistrationBlocked || null,
    };

    if (editingTournamentId && onUpdateTournament) {
      onUpdateTournament(editingTournamentId, tournamentDetails);
    } else {
      onAddTournament(tournamentDetails);
    }

    handleCloseSlider();
  };

  const filteredUsers = useMemo(() => {
    if (!playerSearch.query) return [];
    const q = playerSearch.query.toLowerCase();
    return allUsers.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 5);
  }, [playerSearch.query, allUsers]);

  const { upcomingTournaments, pastTournaments, trashTournaments } =
    useMemo(() => {
      const today = new Date().toISOString().split("T")[0];
      const upcoming: Tournament[] = [];
      const past: Tournament[] = [];
      const trash: Tournament[] = [];

      tournaments.forEach((t) => {
        if (t.deletedAt) {
          if (isAdmin) trash.push(t);
          return;
        }

        const isPast = !!t.date && t.date < today;
        if (isPast) {
          const isHidden = t.hideExpired ?? false;
          if (isAdmin || !isHidden) {
            past.push(t);
          }
        } else {
          upcoming.push(t);
        }
      });

      upcoming.sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;
        return (a.startTime || "").localeCompare(b.startTime || "");
      });

      past.sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        const dateCmp = b.date.localeCompare(a.date);
        if (dateCmp !== 0) return dateCmp;
        return (b.startTime || "").localeCompare(a.startTime || "");
      });

      return {
        upcomingTournaments: upcoming,
        pastTournaments: past,
        trashTournaments: trash,
      };
    }, [tournaments, isAdmin]);

  const renderEventList = (
    events: Tournament[],
    isTrashView = false,
    isUpcomingView = false,
  ) => {
    if (events.length === 0) {
      return (
        <div className="col-span-full bg-white p-12 md:p-20 rounded-[1.5rem] border-2 border-dashed border-slate-200 text-center flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-2">
            <i
              className={`fa-solid ${isTrashView ? "fa-trash-can" : "fa-calendar-day"} text-4xl`}
            ></i>
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-400 uppercase tracking-tighter">
              Aktuell keine Events in diesem Bereich
            </h3>
            {isAdmin && isUpcomingView && !isTrashView && (
              <div className="mt-6">
                <button
                  onClick={() => handleOpenSlider()}
                  className="bg-[var(--color-primary)] hover:bg-[#205234] text-white px-6 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-transform hover:scale-105 active:scale-95 flex items-center gap-3 shadow-md mx-auto"
                >
                  <i className="fa-solid fa-plus text-base"></i> Neues Event
                  anlegen
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    const renderedEvents = events.map((t) => {
      const isRegistered = t.participants.includes(currentUser.name);
      const hasDate = !!t.date;

      let formattedDateStr = "Datum offen";
      if (hasDate) {
        const dateObj = new Date(t.date!);
        const dStr = dateObj.toLocaleDateString("de-DE", {
          weekday: "short",
          day: "numeric",
          month: "short",
        });
        formattedDateStr = dStr.replace(/,/g, "").replace(/\.\./g, ".");
        if (!formattedDateStr.includes(".")) {
          formattedDateStr = formattedDateStr.replace(
            /^(Mo|Di|Mi|Do|Fr|Sa|So)/,
            "$1.",
          );
        }
      }

      const hasTime = !!t.startTime;
      const formattedTimeStr = hasTime
        ? `${t.startTime}${t.endTime ? ` - ${t.endTime}` : ""} Uhr`
        : "Uhrzeit offen";

      return (
        <div
          key={t.id}
          id={`event-${t.id}`}
          className={`bg-white rounded-xl border flex flex-col justify-between h-full overflow-hidden transition-all duration-300 ${
            highlightEventId === t.id
              ? "border-amber-400 ring-4 ring-amber-400/20 shadow-lg scale-[1.01]"
              : "border-slate-200"
          }`}
        >
          <div className="p-4 border-b border-slate-100 flex flex-col gap-1.5 relative">
            <div className="flex justify-between items-start gap-2">
              <h3
                className="text-sm font-black md:font-black uppercase text-[var(--color-primary)] line-clamp-2 leading-tight overflow-hidden text-ellipsis flex-1"
                title={t.title}
              >
                {t.title}
              </h3>
              {highlightEventId === t.id && (
                <span className="bg-amber-100 text-amber-800 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full select-none shrink-0">
                  Ausgewählt
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <span className="inline-flex items-center gap-1.5 bg-slate-100/80 text-slate-700 border border-slate-200/80 px-2 py-0.5 rounded-md text-[10px] font-black md:font-normal uppercase tracking-wider">
                <i className="fa-regular fa-calendar text-slate-400"></i>
                {formattedDateStr}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-slate-100/80 text-slate-700 border border-slate-200/80 px-2 py-0.5 rounded-md text-[10px] font-black md:font-normal uppercase tracking-wider">
                <i className="fa-regular fa-clock text-slate-400"></i>
                {formattedTimeStr}
              </span>
              {t.isRegistrationBlocked && (
                <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider">
                  <i className="fa-solid fa-lock text-red-400"></i>
                  Gesperrt
                </span>
              )}
            </div>
          </div>

          <div className="p-4 flex-1 flex flex-col gap-4">
            <div className="relative mb-auto flex flex-col">
              {(() => {
                const descriptionText =
                  t.description || "Keine Beschreibung verfügbar.";
                const hasMore =
                  t.description &&
                  (t.description.length > 115 || t.description.includes("\n"));

                let teaser = descriptionText;
                let rest = "";

                if (hasMore) {
                  let splitIdx = 115;
                  const firstNewline = descriptionText.indexOf("\n");
                  if (firstNewline !== -1 && firstNewline < 115) {
                    splitIdx = firstNewline;
                  } else {
                    const nextSpace = descriptionText.indexOf(" ", 115);
                    if (nextSpace !== -1 && nextSpace - 115 < 20) {
                      splitIdx = nextSpace;
                    }
                  }
                  teaser = descriptionText.slice(0, splitIdx);
                  rest = descriptionText.slice(splitIdx);
                }

                return (
                  <div className="text-slate-600 text-xs font-medium leading-relaxed">
                    <p className="inline">
                      {teaser}
                      {!expandedMobile[t.id] && hasMore ? "..." : ""}
                    </p>
                    {hasMore && (
                      <div
                        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out overflow-hidden
                                ${
                                  expandedMobile[t.id]
                                    ? "grid-rows-[1fr] opacity-100 mt-1.5"
                                    : "grid-rows-[0fr] opacity-0"
                                }`}
                      >
                        <div className="min-h-0">
                          <p className="whitespace-pre-wrap">{rest}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
              {t.description &&
                (t.description.length > 115 ||
                  t.description.includes("\n")) && (
                  <button
                    onClick={() => {
                      setExpandedMobile((prev) => ({
                        ...prev,
                        [t.id]: !prev[t.id],
                      }));
                    }}
                    className="text-[var(--color-accent)] hover:text-[color-mix(in srgb, var(--color-accent) 80%, black)] text-[10px] font-black uppercase tracking-wider mt-1.5 focus:outline-none flex items-center gap-1.5 active:scale-95 transition-transform self-start"
                  >
                    {expandedMobile[t.id] ? (
                      <>
                        <i className="fa-solid fa-chevron-up"></i> Weniger
                        anzeigen
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-chevron-down"></i> Weiteres...
                      </>
                    )}
                  </button>
                )}
            </div>

            {isAdmin && (
              <div className="relative pt-2 border-t border-slate-100 flex flex-col gap-1">
                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">
                  Teilnehmer manuell (Admin)
                </label>
                <input className="w-full px-2.5 border border-slate-200 rounded-lg outline-none focus:border-[var(--color-primary)] bg-slate-50 focus:bg-white transition-colors p-2 text-sm placeholder: placeholder: placeholder: font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                  placeholder="Name suchen..."
                  value={
                    playerSearch.tournamentId === t.id ? playerSearch.query : ""
                  }
                  onChange={(e) =>
                    setPlayerSearch({
                      tournamentId: t.id,
                      query: e.target.value,
                    })
                  }
                />
                {playerSearch.tournamentId === t.id &&
                  filteredUsers.length > 0 && (
                    <div className="absolute z-50 w-full mt-[50px] bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
                      {filteredUsers.map((u) => {
                        const nameText =
                          u.klarname ||
                          (u.firstName || u.lastName
                            ? `${u.firstName || ""} ${u.lastName || ""}`.trim()
                            : u.name);
                        const hasLabel =
                          u.klarname || u.firstName || u.lastName;
                        return (
                          <button
                            key={u.id}
                            className="w-full text-left px-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center justify-between py-2.5 text-sm font-medium"
                            onClick={() => {
                              onToggleRegistration(t.id, u.name);
                              setPlayerSearch({ tournamentId: "", query: "" });
                            }}
                          >
                            <span className="truncate">{nameText}</span>
                            {hasLabel && (
                              <span className="text-[9px] text-slate-400 font-mono font-medium ml-2">
                                @{u.name}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex-1 flex flex-col">
              {t.maxParticipants && t.maxParticipants > 0 ? (
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center justify-between">
                  <span>
                    Teilnehmer ({t.participants?.length || 0} von{" "}
                    {t.maxParticipants})
                  </span>
                  <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                    Max. {t.maxParticipants}
                  </span>
                </h4>
              ) : (
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">
                  Teilnehmer ({t.participants?.length || 0})
                </h4>
              )}
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto scrollbar-thin">
                {t.participants &&
                  t.participants.map((p, idx) => {
                    const comment = (t as any).registrationComments?.[p];
                    const playerDisplayName = getUserDisplayName(p);
                    return (
                      <div
                        key={idx}
                        className="bg-slate-50 border border-slate-200 p-2 rounded-xl flex flex-col gap-1"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 flex-wrap">
                            <span>{playerDisplayName}</span>
                          </span>
                          {isAdmin && (
                            <button
                              onClick={() => onToggleRegistration(t.id, p)}
                              className="text-red-400 hover:text-red-600 transition-colors"
                            >
                              <i className="fa-solid fa-circle-xmark"></i>
                            </button>
                          )}
                        </div>
                        {comment && (
                          <p className="text-[10px] font-semibold text-slate-500 italic pl-5">
                            "{comment}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                {(!t.participants || t.participants.length === 0) && (
                  <span className="text-slate-400 text-[10px] font-bold italic">
                    Noch keine Anmeldungen
                  </span>
                )}
              </div>
            </div>

            {!isAdmin &&
              t.allowComment &&
              !isRegistered &&
              !t.isRegistrationBlocked &&
              !(
                t.maxParticipants &&
                t.maxParticipants > 0 &&
                (t.participants?.length || 0) >= t.maxParticipants
              ) && (
                <div className="mt-3 space-y-1">
                  <label className="block text-[9px] font-black text-slate-400 uppercase">
                    Optionaler Kommentar
                  </label>
                  <input 
                    type="text"
                    placeholder="z.B. Salat, Salatbesteck..."
                    value={commentInputs[t.id] || ""}
                    onChange={(e) =>
                      setCommentInputs({
                        ...commentInputs,
                        [t.id]: e.target.value,
                      })
                    }
                    className="w-full px-2.5 border-2 border-slate-200 rounded-xl text-xs outline-none bg-white focus:border-[var(--color-accent)] py-2 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>
              )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-3 pb-6 shrink-0 mt-auto">
            <div className="flex gap-2">
              {!isAdmin &&
                (() => {
                  const isFull =
                    t.maxParticipants &&
                    t.maxParticipants > 0 &&
                    (t.participants?.length || 0) >= t.maxParticipants;
                  const disableRegister =
                    t.isRegistrationBlocked || (isFull && !isRegistered);

                  let btnText = isRegistered ? "Abmelden" : "Anmelden";
                  let btnIcon = isRegistered ? "fa-user-minus" : "fa-user-plus";

                  if (t.isRegistrationBlocked) {
                    btnText = "Anmeldung gesperrt";
                    btnIcon = "fa-lock";
                  } else if (isFull && !isRegistered) {
                    btnText = "Ausgebucht";
                    btnIcon = "fa-user-slash";
                  }

                  return (
                    <button
                      disabled={disableRegister && !isRegistered} // block registration if closed/full, but let them deregister if already in list
                      onClick={() => {
                        if (disableRegister && !isRegistered) return;
                        onToggleRegistration(
                          t.id,
                          undefined,
                          commentInputs[t.id],
                        );
                        if (!isRegistered) {
                          setCommentInputs({ ...commentInputs, [t.id]: "" });
                        }
                      }}
                      className={`flex-1 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-md flex items-center justify-center gap-2 ${
                        disableRegister && !isRegistered
                          ? "bg-slate-150 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none"
                          : isRegistered
                            ? "bg-slate-200 text-slate-600 hover:bg-slate-300 active:scale-95"
                            : "bg-[var(--color-primary)] text-white hover:bg-[color-mix(in srgb, var(--color-primary) 80%, black)] active:scale-95"
                      }`}
                    >
                      <i className={`fa-solid ${btnIcon}`}></i>
                      {btnText}
                    </button>
                  );
                })()}
              {isAdmin && !isTrashView && (
                <div className="flex gap-1.5 w-full opacity-60 hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleOpenAudit(t.id)}
                    className="flex-1 p-2 border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors font-bold uppercase text-[9px] flex items-center justify-center gap-1.5"
                  >
                    <i className="fa-solid fa-list-check hidden sm:inline-block"></i>{" "}
                    Audit
                  </button>
                  <button
                    onClick={() => handleOpenSlider(t)}
                    className="flex-1 px-3 border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white rounded-lg transition-colors font-bold uppercase text-[9px] flex items-center justify-center gap-1.5"
                  >
                    <i className="fa-solid fa-pen hidden sm:inline-block"></i>{" "}
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (onUpdateTournament) {
                        onUpdateTournament(t.id, {
                          deletedAt: new Date().toISOString(),
                        });
                      }
                    }}
                    className="flex-1 p-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg transition-colors font-bold uppercase text-[9px] flex items-center justify-center gap-1.5"
                  >
                    <i className="fa-solid fa-trash-can hidden sm:inline-block"></i>{" "}
                    Del
                  </button>
                </div>
              )}
              {isAdmin && isTrashView && (
                <button
                  onClick={() => {
                    if (onUpdateTournament) {
                      onUpdateTournament(t.id, { deletedAt: null as any });
                    }
                  }}
                  className="flex-1 py-2 bg-[var(--color-primary)] text-white hover:bg-[color-mix(in srgb, var(--color-primary) 80%, black)] rounded-lg transition-colors font-bold uppercase text-[9px] flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-trash-arrow-up"></i>{" "}
                  Wiederherstellen
                </button>
              )}
            </div>
          </div>
        </div>
      );
    });

    if (isAdmin && isUpcomingView && !isTrashView) {
      renderedEvents.push(
        <button
          key="add-new-event"
          onClick={() => handleOpenSlider()}
          className="bg-white border-2 border-dashed border-slate-300 hover:border-[var(--color-primary)] hover:bg-slate-50 text-slate-500 hover:text-[var(--color-primary)] rounded-[1.5rem] flex flex-col items-center justify-center gap-3 transition-all p-8 md:p-12 min-h-[250px] group cursor-pointer"
        >
          <div className="w-16 h-16 bg-slate-100 group-hover:bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center transition-colors">
            <i className="fa-solid fa-plus text-2xl"></i>
          </div>
          <span className="text-sm font-black uppercase tracking-widest">
            Neues Event
          </span>
        </button>
      );
    }

    return <>{renderedEvents}</>;
  };

  return (
    <div className="lg:animate-in lg:fade-in lg:duration-500 space-y-6">
      {/* Slider Drawer via Portal */}
      {isSliderOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex justify-end bg-slate-900/60 backdrop-blur-[2px] transition-opacity"
            onClick={handleCloseSlider}
            style={{
              opacity: !isAnimatingIn || isClosing ? 0 : 1,
              transitionDuration: isClosing ? "200ms" : "250ms",
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              pointerEvents: isClosing ? "none" : "auto",
            }}
          >
            <div
              className="w-[450px] max-w-[100vw] h-[100vh] bg-white shadow-2xl flex flex-col transform transition-transform pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
              style={{
                transform:
                  !isAnimatingIn || isClosing
                    ? "translateX(100%)"
                    : "translateX(0)",
                transitionDuration: isClosing ? "200ms" : "250ms",
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              {/* Drawer Header */}
              <div className="p-4 px-5 text-white flex justify-between items-start relative shrink-0 shadow-md overflow-hidden bg-[var(--color-primary)]">
                {/* Background Relief Watermark */}
                <div className="absolute -bottom-10 -right-6 text-white opacity-[0.06] z-0 pointer-events-none transform -rotate-12">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-[140px] h-[140px]"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M5.5 5.5A7.5 7.5 0 0 1 12 12A7.5 7.5 0 0 1 5.5 18.5"></path>
                    <path d="M18.5 5.5A7.5 7.5 0 0 0 12 12A7.5 7.5 0 0 0 18.5 18.5"></path>
                  </svg>
                </div>

                <div className="relative z-10">
                  <h3 className="text-xl font-bold uppercase tracking-tight leading-none mb-1">
                    {editingTournamentId ? "Bearbeiten" : "Neues Event"}
                  </h3>
                  <p className="text-[11px] font-bold text-white/90 flex items-center gap-1.5">
                    <i
                      className={`fa-solid ${editingTournamentId ? "fa-pen" : "fa-calendar-plus"} opacity-75`}
                    ></i>
                    {editingTournamentId
                      ? "Veranstaltung anpassen"
                      : "Veranstaltung anlegen"}
                  </p>
                </div>
                <button
                  onClick={handleCloseSlider}
                  className="text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm shrink-0 relative z-10 text-sm font-medium"
                >
                  <i className="fa-solid fa-xmark text-base"></i>
                </button>
              </div>

              {/* Scrollable Form Area */}
              <div
                className="p-5 space-y-5 overflow-y-auto flex-1 bg-white"
                style={{ isolation: "isolate" }}
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                      Name der Veranstaltung{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text"
                      required
                      value={formData.title || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      className="w-full p-2 border-2 border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:border-[var(--color-primary)] outline-none text-xs shadow-sm transition-colors text-slate-700 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                      placeholder="z.B. Sommerfest, Schleiferlturnier"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                      Datum (Optional)
                    </label>
                    <input 
                      type="date"
                      value={formData.date || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, date: e.target.value })
                      }
                      className="w-full p-2 border-2 border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:border-[var(--color-primary)] outline-none text-xs shadow-sm transition-colors text-slate-700 uppercase font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-2 gap-3 shrink-0 shadow-sm">
                    <div>
                      <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                        Startzeit
                      </label>
                      <input 
                        type="time"
                        value={formData.startTime || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            startTime: e.target.value,
                          })
                        }
                        className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-[var(--color-primary)] transition-colors placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                        Endzeit
                      </label>
                      <input 
                        type="time"
                        value={formData.endTime || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, endTime: e.target.value })
                        }
                        className="w-full h-8 px-3 py-1 border-2 border-slate-300 rounded-lg bg-white text-sm outline-none focus:border-[var(--color-primary)] transition-colors placeholder:font-normal placeholder:text-slate-400 font-sans font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                      Beschreibung (Optional)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      className="w-full p-3 border-2 border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:border-[var(--color-primary)] outline-none text-xs shadow-sm transition-colors h-24 resize-none text-slate-700 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                      placeholder="Details, Ablauf, Verpflegung..."
                    />
                  </div>
                </div>

                {/* Advanced options */}
                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3">
                    Archivierung nach Ablauf der Veranstaltung:
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <div className="flex flex-col gap-3">
                        <label className="flex items-center gap-3 text-[12px] font-bold text-slate-700 cursor-pointer bg-slate-50 hover:bg-slate-100 p-3 rounded-xl border border-slate-200 transition-colors">
                          <input
                            type="radio"
                            checked={!formData.hideExpired}
                            onChange={() =>
                              setFormData({ ...formData, hideExpired: false })
                            }
                            className="w-4 h-4 accent-slate-800 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                          <span>
                            In den Reiter "Vergangene Veranstaltungen"
                            verschieben (Standard)
                          </span>
                        </label>
                        <label className="flex items-center gap-3 text-[12px] font-bold text-slate-700 cursor-pointer bg-slate-50 hover:bg-slate-100 p-3 rounded-xl border border-slate-200 transition-colors">
                          <input
                            type="radio"
                            checked={formData.hideExpired}
                            onChange={() =>
                              setFormData({ ...formData, hideExpired: true })
                            }
                            className="w-4 h-4 accent-slate-800 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                          <span>Komplett ausblenden</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3 mt-5 border-t border-slate-200 pt-5">
                    Kommentarfeld bei Anmeldung anzeigen?
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            checked={formData.allowComment}
                            onChange={() =>
                              setFormData({ ...formData, allowComment: true })
                            }
                            className="w-4 h-4 accent-slate-800 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                          <span>Ja</span>
                        </label>
                        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            checked={!formData.allowComment}
                            onChange={() =>
                              setFormData({ ...formData, allowComment: false })
                            }
                            className="w-4 h-4 accent-slate-800 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                          <span>Nein</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 mt-4">
                        Max. Teilnehmerzahl (Optional)
                      </label>
                      <input 
                        type="number"
                        min="1"
                        placeholder="Kein Limit"
                        value={formData.maxParticipants}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            maxParticipants: e.target.value,
                          })
                        }
                        className="w-full p-2 border-2 border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:border-[var(--color-primary)] outline-none text-xs shadow-sm transition-colors font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>

                    <div className="pt-4 border-t border-slate-200 mt-4">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3">
                        Neuanmeldungen blockieren?
                      </h4>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            checked={formData.isRegistrationBlocked}
                            onChange={() =>
                              setFormData({
                                ...formData,
                                isRegistrationBlocked: true,
                              })
                            }
                            className="w-4 h-4 accent-red-500 font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                          <span>Gesperrt</span>
                        </label>
                        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            checked={!formData.isRegistrationBlocked}
                            onChange={() =>
                              setFormData({
                                ...formData,
                                isRegistrationBlocked: false,
                              })
                            }
                            className="w-4 h-4 accent-[var(--color-primary)] font-sans font-medium placeholder:font-normal placeholder:text-slate-400"
                          />
                          <span>Offen</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons at the end of the scroll container */}
                <div className="pt-5 border-t border-slate-200 pb-5">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="w-full text-white rounded-xl shadow-md transition-transform active:scale-95 uppercase tracking-widest flex items-center justify-center gap-2 bg-[var(--color-primary)] hover:bg-[color-mix(in srgb, var(--color-primary) 80%, black)] animate-none font-sans py-2.5 text-sm font-medium"
                  >
                    <i
                      className={`fa-solid ${editingTournamentId ? "fa-floppy-disk" : "fa-check"} text-[12px]`}
                    ></i>
                    {editingTournamentId ? "Event speichern" : "Event anlegen"}
                  </button>

                  {editingTournamentId && isAdmin && (
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="w-full mt-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95 uppercase tracking-wider font-sans bg-white shadow-sm py-2.5 text-sm font-medium"
                    >
                      <i className={`fa-solid ${copied ? "fa-circle-check text-green-600" : "fa-link"} text-[11px]`}></i>
                      {copied ? "✓ Kopiert!" : "Event-Link kopieren"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <div className="flex flex-col space-y-4 lg:space-y-5 w-full lg:animate-in lg:fade-in lg:duration-500">
        {/* 1. TOP HEADER (LIGHT MODE - IDENTISCH ZU RANGLISTE) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-50 rounded-2xl text-[var(--color-primary)] shrink-0">
                <PartyPopper className="w-5 h-5 text-[var(--color-primary)]" strokeWidth={1.8} />
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-xl font-bold text-slate-900 uppercase tracking-wider">
                    Veranstaltungen
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-medium tracking-wide mt-1">
                  Anmeldung zu Turnieren und anderen Events
                </p>
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenSlider()}
                  className="h-9 px-3.5 bg-[var(--color-primary)] hover:opacity-90 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-xs active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Neues Event</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 items-stretch">
          {renderEventList(upcomingTournaments, false, true)}
        </div>

        {pastTournaments.length > 0 && (
          <div className="pt-4 lg:pt-6 space-y-4">
            <button
              onClick={() => setShowPastEvents(!showPastEvents)}
              type="button"
              className="w-full bg-slate-50 border-2 border-slate-200 hover:border-slate-300 text-slate-500 font-black uppercase tracking-widest text-xs py-4 rounded-2xl flex items-center justify-center gap-3 transition-colors outline-none cursor-pointer"
            >
              <i
                className={`fa-solid fa-chevron-${showPastEvents ? "up" : "down"}`}
              ></i>
              Vergangene Veranstaltungen ({pastTournaments.length})
            </button>

            {showPastEvents && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 animate-in fade-in slide-in-from-top-4 duration-300">
                {renderEventList(pastTournaments)}
              </div>
            )}
          </div>
        )}

        {isAdmin && trashTournaments.length > 0 && (
          <div className="pt-4 lg:pt-6 space-y-4">
            <button
              onClick={() => setShowTrash(!showTrash)}
              type="button"
              className="w-full bg-red-50 hover:bg-red-100 border-2 border-red-200 text-red-500 font-black uppercase tracking-widest text-xs py-4 rounded-2xl flex items-center justify-center gap-3 transition-colors outline-none cursor-pointer"
            >
              <i className={`fa-solid fa-trash-can`}></i>
              Papierkorb ({trashTournaments.length}){" "}
              <i
                className={`fa-solid fa-chevron-${showTrash ? "up" : "down"}`}
              ></i>
            </button>

            {showTrash && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 animate-in fade-in slide-in-from-top-4 duration-300">
                {renderEventList(trashTournaments, true)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Audit Modal Slider */}
      {auditModalId &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex justify-end bg-slate-900/60 backdrop-blur-[2px] transition-opacity"
            onClick={handleCloseAudit}
            style={{
              opacity: !isAuditAnimatingIn || isAuditClosing ? 0 : 1,
              transitionDuration: isAuditClosing ? "200ms" : "250ms",
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              pointerEvents: isAuditClosing ? "none" : "auto",
            }}
          >
            <div
              className="w-[450px] max-w-[100vw] h-[100vh] bg-white shadow-2xl flex flex-col transform transition-transform pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
              style={{
                transform:
                  !isAuditAnimatingIn || isAuditClosing
                    ? "translateX(100%)"
                    : "translateX(0)",
                transitionDuration: isAuditClosing ? "200ms" : "250ms",
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              {/* Drawer Header */}
              <div className="p-4 px-5 text-white flex justify-between items-start relative shrink-0 shadow-md overflow-hidden bg-slate-800">
                {/* Background Relief Watermark */}
                <div className="absolute -bottom-10 -right-6 text-white opacity-[0.06] z-0 pointer-events-none transform -rotate-12">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-[140px] h-[140px]"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M5.5 5.5A7.5 7.5 0 0 1 12 12A7.5 7.5 0 0 1 5.5 18.5"></path>
                    <path d="M18.5 5.5A7.5 7.5 0 0 0 12 12A7.5 7.5 0 0 0 18.5 18.5"></path>
                  </svg>
                </div>

                <div className="relative z-10">
                  <h3 className="text-xl font-bold uppercase tracking-tight leading-none mb-1">
                    Audit Log
                  </h3>
                  <p className="text-[11px] font-bold text-white/90 flex items-center gap-1.5">
                    <i className="fa-solid fa-clock-rotate-left opacity-75"></i>{" "}
                    Verlauf der An- und Abmeldungen
                  </p>
                </div>
                <button
                  onClick={handleCloseAudit}
                  className="text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm shrink-0 relative z-10 text-sm font-medium"
                >
                  <i className="fa-solid fa-xmark text-base"></i>
                </button>
              </div>

              <div
                className="p-5 overflow-y-auto flex-1 bg-white space-y-4"
                style={{ isolation: "isolate" }}
              >
                {(() => {
                  const targetTournament = tournaments.find(
                    (t) => t.id === auditModalId,
                  );
                  const logs = targetTournament?.auditLog || [];
                  if (logs.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-3">
                        <i className="fa-solid fa-receipt text-3xl opacity-20"></i>
                        <p className="text-sm font-bold uppercase tracking-wider text-center">
                          Noch keine Einträge
                        </p>
                      </div>
                    );
                  }
                  return logs.map((log, i) => {
                    const playerDisplayName = getUserDisplayName(log.userName);
                    const hasDifferentActor =
                      log.actorName && log.actorName !== log.userName;
                    const actorDisplayName = hasDifferentActor
                      ? getUserDisplayName(log.actorName!)
                      : null;

                    return (
                      <div
                        key={i}
                        className="flex gap-3 h-8 px-3 py-1 bg-slate-50 border border-slate-100 rounded-xl items-center shadow-sm font-sans font-medium"
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex shrink-0 items-center justify-center text-white text-sm shadow-sm ${
                            log.action === "create"
                              ? "bg-blue-500"
                              : log.action === "register"
                                ? "bg-[var(--color-primary)]"
                                : log.action === "unregister"
                                  ? "bg-red-500"
                                  : "bg-slate-500"
                          }`}
                        >
                          <i
                            className={`fa-solid ${
                              log.action === "create"
                                ? "fa-plus"
                                : log.action === "register"
                                  ? "fa-user-plus"
                                  : log.action === "unregister"
                                    ? "fa-user-minus"
                                    : "fa-info"
                            } text-xs`}
                          ></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-extrabold text-xs text-slate-700 truncate">
                            {playerDisplayName}
                          </p>
                          {hasDifferentActor && (
                            <p className="text-[10px] font-bold text-slate-500 mt-0.5 flex items-center gap-1 flex-wrap">
                              <i className="fa-solid fa-user-gear text-[10px] opacity-70"></i>
                              <span>
                                durch <strong>{actorDisplayName}</strong>
                              </span>
                            </p>
                          )}
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                            {new Date(log.timestamp).toLocaleString("de-DE")}
                          </p>
                        </div>
                        <div
                          className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                            log.action === "create"
                              ? "bg-blue-100 text-blue-600"
                              : log.action === "register"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-600"
                          }`}
                        >
                          {log.action === "create"
                            ? "Erstellt"
                            : log.action === "register"
                              ? hasDifferentActor
                                ? "Hinzugefügt"
                                : "Angemeldet"
                              : hasDifferentActor
                                ? "Entfernt"
                                : "Abgemeldet"}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default Tournaments;
