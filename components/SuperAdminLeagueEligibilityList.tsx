import React, { useState, useMemo } from 'react';
import { Person, League } from '../types';

interface Props {
  allPersons: Person[];
  dynamicLeagues: League[];
}

export default function SuperAdminLeagueEligibilityList({ allPersons, dynamicLeagues }: Props) {
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");

  const selectedLeague = dynamicLeagues.find(l => l.id === selectedLeagueId);

  const eligibleUsers = useMemo(() => {
    if (!selectedLeague) return [];

    return allPersons.filter((person) => {
      // 1. Check gender
      if (selectedLeague.allowedGenders && selectedLeague.allowedGenders.length > 0) {
        if (!person.gender || !selectedLeague.allowedGenders.includes(person.gender)) {
          return false;
        }
      }

      // 2. Check age
      let age: number | null = null;
      if (person.birthDate) {
        const birth = new Date(person.birthDate);
        const today = new Date();
        age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
          age--;
        }
      }

      if (selectedLeague.minAge !== undefined && selectedLeague.minAge !== null) {
        if (age === null || age < selectedLeague.minAge) return false;
      }
      if (selectedLeague.maxAge !== undefined && selectedLeague.maxAge !== null) {
        if (age === null || age > selectedLeague.maxAge) return false;
      }

      return true;
    }).sort((a, b) => {
      const nameA = a.firstName || a.lastName ? `${a.firstName || ''} ${a.lastName || ''}`.trim() : a.name || a.id;
      const nameB = b.firstName || b.lastName ? `${b.firstName || ''} ${b.lastName || ''}`.trim() : b.name || b.id;
      return nameA.localeCompare(nameB);
    });
  }, [allPersons, selectedLeague]);

  return (
    <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 shadow-sm mt-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-users-viewfinder text-indigo-500 text-lg"></i>
            <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">
              Test der Liga-Berechtigung
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1 max-w-3xl">
            Überprüfe, welche registrierten Benutzer anhand ihrer Profil-Daten (Alter, Geschlecht) 
            für eine spezifische Liga spielberechtigt sind.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">
            Liga auswählen
          </label>
          <div className="relative">
            <select
              value={selectedLeagueId}
              onChange={(e) => setSelectedLeagueId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-10 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer font-sans font-medium"
            >
              <option value="">-- Bitte wählen --</option>
              {dynamicLeagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name} {league.status === 'inactive' ? '(Inaktiv)' : ''}
                </option>
              ))}
            </select>
            <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
          </div>
        </div>

        {selectedLeague && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-sm font-bold text-slate-800">
                Berechtigte Spieler für {selectedLeague.name}
              </h3>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                {eligibleUsers.length} Treffer
              </span>
            </div>

            {eligibleUsers.length > 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <ul className="divide-y divide-slate-100">
                  {eligibleUsers.map((user) => {
                    const displayName = user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.name || user.id;
                    return (
                      <li key={user.id} className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold shrink-0">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-800">{displayName}</div>
                            {user.email && (
                              <div className="text-[10px] text-slate-500">{user.email}</div>
                            )}
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {user.gender === 'm' ? 'Männlich' : user.gender === 'w' ? 'Weiblich' : 'Keine Angabe'}
                          {user.birthDate ? ` • ${new Date().getFullYear() - new Date(user.birthDate).getFullYear()} Jahre` : ''}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-xs">
                <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-300">
                  <i className="fa-solid fa-user-slash text-xl"></i>
                </div>
                <h4 className="text-sm font-bold text-slate-700 mb-1">Keine berechtigten Spieler</h4>
                <p className="text-xs text-slate-500">
                  Für diese Liga-Kriterien konnten keine passenden Benutzer gefunden werden.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
