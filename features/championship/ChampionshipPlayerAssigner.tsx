import React, { useState } from 'react';
import { Search, UserPlus, Trash2, Shield, UserX, Check, AlertCircle, ArrowRight, X } from 'lucide-react';
import { TournamentInstance, Participant, Group } from '../../types/championship';
import { User } from '../../types';

interface ChampionshipPlayerAssignerProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: TournamentInstance;
  users: Record<string, User>;
  onSaveAssignments: (updatedParticipants: Participant[], updatedGroups: Group[]) => Promise<void>;
}

export const ChampionshipPlayerAssigner: React.FC<ChampionshipPlayerAssignerProps> = ({
  isOpen,
  onClose,
  tournament,
  users,
  onSaveAssignments,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [participants, setParticipants] = useState<Participant[]>(
    tournament.participants ? JSON.parse(JSON.stringify(tournament.participants)) : []
  );
  const [groups, setGroups] = useState<Group[]>(
    tournament.groups ? JSON.parse(JSON.stringify(tournament.groups)) : []
  );
  const [saving, setSaving] = useState<boolean>(false);
  const [selectedGroupForAssign, setSelectedGroupForAssign] = useState<string>(
    tournament.groups?.[0]?.id || ''
  );

  if (!isOpen) return null;

  const allUsersList = Object.values(users) as User[];

  // Filtered members list
  const filteredUsers = allUsersList.filter((u) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = (u.name || '').toLowerCase().includes(q);
    const firstMatch = (u.firstName || '').toLowerCase().includes(q);
    const lastMatch = (u.lastName || '').toLowerCase().includes(q);
    return nameMatch || firstMatch || lastMatch;
  });

  const isUserAssigned = (userId: string): boolean => {
    return participants.some(
      (p) => p.playerIds.includes(userId) || p.playerIds.includes(users[userId]?.name || '')
    );
  };

  const getPlayerDisplayName = (playerId: string): string => {
    const u = users[playerId.toLowerCase().replace(/\s/g, '')] || users[playerId];
    if (u) {
      const first = u.firstName || '';
      const last = u.lastName || '';
      if (first && last) return `${first} ${last}`;
      return u.name || playerId;
    }
    return playerId;
  };

  // Add member to tournament and group
  const handleAssignMember = (user: User) => {
    if (isUserAssigned(user.id)) return;

    const newParticipantId = `part_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newParticipant: Participant = {
      id: newParticipantId,
      playerIds: [user.id],
      displayNames: [user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.name],
      groupAssignment: selectedGroupForAssign || null,
      withdrawn: false,
    };

    const nextParticipants = [...participants, newParticipant];
    setParticipants(nextParticipants);

    if (selectedGroupForAssign) {
      setGroups(
        groups.map((g) => {
          if (g.id === selectedGroupForAssign) {
            return {
              ...g,
              participantIds: [...g.participantIds, newParticipantId],
            };
          }
          return g;
        })
      );
    }
  };

  // Remove participant from tournament
  const handleRemoveParticipant = (participantId: string) => {
    setParticipants(participants.filter((p) => p.id !== participantId));
    setGroups(
      groups.map((g) => ({
        ...g,
        participantIds: g.participantIds.filter((id) => id !== participantId),
      }))
    );
  };

  // Toggle injury / withdrawal
  const handleToggleWithdrawn = (participantId: string) => {
    setParticipants(
      participants.map((p) => {
        if (p.id === participantId) {
          const nextState = !p.withdrawn;
          return {
            ...p,
            withdrawn: nextState,
            withdrawnAt: nextState ? new Date().toISOString() : null,
            withdrawnReason: nextState ? 'Ausfall / Verletzung' : null,
          };
        }
        return p;
      })
    );
  };

  // Update seed
  const handleUpdateSeed = (participantId: string, seedVal: string) => {
    const parsed = parseInt(seedVal);
    setParticipants(
      participants.map((p) => {
        if (p.id === participantId) {
          return {
            ...p,
            seed: isNaN(parsed) || parsed <= 0 ? null : parsed,
          };
        }
        return p;
      })
    );
  };

  // Move participant to another group
  const handleMoveGroup = (participantId: string, targetGroupId: string) => {
    setParticipants(
      participants.map((p) => (p.id === participantId ? { ...p, groupAssignment: targetGroupId } : p))
    );

    setGroups(
      groups.map((g) => {
        if (g.id === targetGroupId) {
          if (!g.participantIds.includes(participantId)) {
            return { ...g, participantIds: [...g.participantIds, participantId] };
          }
        } else {
          return { ...g, participantIds: g.participantIds.filter((id) => id !== participantId) };
        }
        return g;
      })
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveAssignments(participants, groups);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl xl:max-w-7xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Teilnehmer & Gruppen-Zuweisung ({participants.length} gemeldet)
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {tournament.title} · Spieler per Klick zuweisen, Setzliste festlegen oder bei Verletzung als Walkover markieren.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Split Pane */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
          {/* Left: Member Directory Search */}
          <div className="md:col-span-5 border-r border-slate-200/80 p-4 flex flex-col h-full bg-slate-50/50">
            <div className="mb-3 space-y-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                1. Mitglied auswählen
              </span>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Mitglied suchen..."
                  value={searchQuery || ''}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-[var(--color-primary)] placeholder:text-slate-400"
                />
              </div>

              {groups.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Zielgruppe:</span>
                  <select
                    value={selectedGroupForAssign || ''}
                    onChange={(e) => setSelectedGroupForAssign(e.target.value)}
                    className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 cursor-pointer"
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Scrollable Members List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filteredUsers.map((user) => {
                const assigned = isUserAssigned(user.id);
                const fullName =
                  user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.name;

                return (
                  <div
                    key={user.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                      assigned
                        ? 'bg-slate-100/70 border-slate-200 text-slate-400'
                        : 'bg-white border-slate-200 hover:border-[var(--color-primary)] text-slate-800'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <span className="font-bold block truncate">{fullName}</span>
                      <span className="text-[10px] text-slate-400">{user.name}</span>
                    </div>

                    {assigned ? (
                      <span className="text-[10px] font-bold text-emerald-600 px-2 py-0.5 bg-emerald-50 rounded-md">
                        Bereits dabei
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAssignMember(user)}
                        className="px-2.5 py-1 bg-[var(--color-primary)] text-white text-[11px] font-bold rounded-lg hover:opacity-90 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Zuweisen</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Tournament Groups and Participants */}
          <div className="md:col-span-7 p-4 flex flex-col h-full overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                2. Gruppen & Setzliste
              </span>
              <span className="text-xs font-bold text-slate-400">
                {participants.length} Teilnehmer insgesamt
              </span>
            </div>

            {groups.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                Keine Gruppen vorhanden. Teilnehmer werden direkt in die Setzliste übernommen.
              </div>
            ) : (
              <div className="space-y-4">
                {groups.map((group) => {
                  const groupParticipants = participants.filter((p) =>
                    group.participantIds.includes(p.id)
                  );

                  return (
                    <div
                      key={group.id}
                      className="bg-slate-50/70 rounded-2xl border border-slate-200 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                        <span className="font-black text-xs uppercase tracking-wider text-slate-800">
                          {group.name} ({groupParticipants.length} Spieler)
                        </span>
                      </div>

                      {groupParticipants.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2 text-center">
                          Noch keine Spieler zugewiesen. Wähle links ein Mitglied aus.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {groupParticipants.map((part) => {
                            const name = part.playerIds.map(getPlayerDisplayName).join(' / ');

                            return (
                              <div
                                key={part.id}
                                className={`p-2 bg-white rounded-xl border flex items-center justify-between gap-2 text-xs ${
                                  part.withdrawn
                                    ? 'border-amber-300 bg-amber-50/30'
                                    : 'border-slate-200'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate flex-1">
                                  <input
                                    type="number"
                                    placeholder="Setz"
                                    title="Setzplatz (z. B. 1, 2)"
                                    value={part.seed ?? ''}
                                    onChange={(e) => handleUpdateSeed(part.id, e.target.value)}
                                    className="w-10 text-center py-0.5 border border-slate-200 rounded text-[11px] font-bold"
                                  />
                                  <span className="font-bold text-slate-900 truncate">{name}</span>
                                  {part.withdrawn && (
                                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded">
                                      Ausgeschieden (w/o)
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {/* Move to other group */}
                                  {groups.length > 1 && (
                                    <select
                                      value={group.id}
                                      onChange={(e) => handleMoveGroup(part.id, e.target.value)}
                                      className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded p-1"
                                    >
                                      {groups.map((g) => (
                                        <option key={g.id} value={g.id}>
                                          {g.name}
                                        </option>
                                      ))}
                                    </select>
                                  )}

                                  {/* Toggle Withdrawn */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleWithdrawn(part.id)}
                                    className={`p-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                                      part.withdrawn
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                    title={
                                      part.withdrawn
                                        ? 'Verletzung aufheben'
                                        : 'Als verletzt/ausgeschieden markieren (alle offenen Spiele 6:0, 6:0)'
                                    }
                                  >
                                    w/o
                                  </button>

                                  {/* Remove */}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveParticipant(part.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                    title="Aus Turnier entfernen"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-[var(--color-primary)] hover:opacity-90 active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{saving ? 'Speichern...' : 'Zuweisung speichern'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
