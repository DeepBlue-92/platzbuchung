import React from 'react';
import { User, DynamicLeague } from '../../types';

interface HobbyligaWillkommenProps {
  currentUser: User;
  eligibleLeagues: DynamicLeague[];
  onJoinLeague: (leagueId: string) => void;
}

export const HobbyligaWillkommen: React.FC<HobbyligaWillkommenProps> = ({
  currentUser,
  eligibleLeagues,
  onJoinLeague,
}) => {
  return (
    <div className="w-full flex-grow flex flex-col justify-center items-center py-10 px-4 min-h-0 space-y-6 lg:animate-in lg:fade-in lg:duration-500">
      <div className="w-full max-w-2xl bg-white p-8 rounded-3xl shadow-sm border border-slate-200 text-center">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600 text-3xl">
          <i className="fa-solid fa-trophy"></i>
        </div>
        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-800 mb-4">
          Willkommen in der Hobbyliga
        </h2>
        <p className="text-sm md:text-base text-slate-500 leading-relaxed font-medium mb-8 max-w-lg mx-auto">
          Wähle eine Liga aus, um teilzunehmen. Tritt gegen andere Spieler an, sammle Punkte und verbessere deinen Rang!
        </p>
        
        {!currentUser.gender && (
          <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl text-left flex items-start gap-3">
            <i className="fa-solid fa-circle-info text-amber-600 mt-0.5"></i>
            <p className="text-xs text-amber-800 font-medium">
              Du hast in deinem Profil kein Geschlecht angegeben. Daher siehst du aktuell nur Ligen, die für alle Spieler offen sind (Mixed). 
              Bitte vervollständige dein Profil, um alle für dich zugelassenen Ligen zu sehen.
            </p>
          </div>
        )}

        {eligibleLeagues.length === 0 ? (
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-sm text-slate-600 font-medium">
              Aktuell gibt es keine offenen Ligen für dein Profil.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            {eligibleLeagues.map(l => (
              <div key={l.id} className="p-5 bg-slate-50 border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all rounded-xl flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 uppercase tracking-tight">{l.name}</h3>
                  {l.description && <p className="text-xs text-slate-500 mt-2">{l.description}</p>}
                </div>
                <button 
                  onClick={() => onJoinLeague(l.id)}
                  className="mt-5 w-full py-2.5 bg-[#1b4332] hover:bg-[#112d21] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Jetzt teilnehmen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
