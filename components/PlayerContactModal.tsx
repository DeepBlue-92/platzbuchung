import React from "react";
import { User, Person } from "../types";
import { resolveClubName } from "../services/clubHelper";
import { resolvePlayerDisplayName } from "../utils/playerHelper";



const canViewContactInfo = (user: any, target: any, viewerClubIds?: string[]) => {
  return target.showContactInfo !== false;
};

interface PlayerContactModalProps {
  targetUser: User | Person;
  currentUser: User | Person | null;
  onClose: () => void;
  viewerClubIds?: string[];
  rankPosition?: number | string;
  points?: number | string;
}

export const PlayerContactModal: React.FC<PlayerContactModalProps> = ({
  targetUser,
  currentUser,
  onClose,
  viewerClubIds = [],
  rankPosition,
  points,
}) => {
  if (!targetUser) return null;
  const isAllowed = canViewContactInfo(targetUser, currentUser, viewerClubIds);
  
  const fullName = resolvePlayerDisplayName(targetUser);
  const genderLabel = targetUser.gender === "w" ? "Damen" : "Herren";

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[var(--color-primary)] px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-lg font-black border border-white/20">
              {targetUser.gender === "w" ? (
                <i className="fa-solid fa-venus"></i>
              ) : (
                <i className="fa-solid fa-mars"></i>
              )}
            </div>
            <div>
              <h3 className="text-base font-black tracking-wide leading-tight">{fullName}</h3>
              <p className="text-[10px] uppercase font-bold text-white/80 tracking-widest">
                {genderLabel}-Rangliste • {resolveClubName(targetUser.vereinsId)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Rangplatz-Anzeige waagerecht zentriert ohne Trennlinie */}
          {rankPosition !== undefined && (
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-center">
              <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">
                Rangplatz
              </span>
              <span className="text-base font-black text-slate-800">
                #{rankPosition}
              </span>
            </div>
          )}

          {points !== undefined && (
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-center">
              <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">
                Punktestand
              </span>
              <span className="text-base font-black text-[var(--color-primary)]">
                {typeof points === "number" ? points.toFixed(1) : points}
              </span>
            </div>
          )}

          {/* Contact Information Section */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1 flex items-center gap-1.5">
              <i className="fa-solid fa-address-book text-[11px]"></i> Kontaktdaten
            </h4>

            {isAllowed ? (
              <div className="space-y-3">
                {targetUser.phone ? (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <i className="fa-solid fa-phone text-xs"></i>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 block">Telefon</span>
                      <a href={`tel:${targetUser.phone}`} className="text-xs font-bold text-slate-800 hover:underline">
                        {targetUser.phone}
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Keine Telefonnummer hinterlegt.</p>
                )}

                {targetUser.email && !targetUser.email.endsWith('.system.local') && !targetUser.is_placeholder_email ? (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                      <i className="fa-solid fa-envelope text-xs"></i>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 block">E-Mail</span>
                      <a href={`mailto:${targetUser.email}`} className="text-xs font-bold text-slate-800 hover:underline">
                        {targetUser.email}
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Keine gültige E-Mail-Adresse hinterlegt.</p>
                )}
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900">
                <i className="fa-solid fa-lock text-amber-600 mt-0.5 text-sm"></i>
                <div className="text-xs leading-relaxed font-medium">
                  <strong>Kontaktdaten geschützt</strong>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Dieser Spieler hat seine Kontaktinformationen nicht für die Regio-Rangliste freigegeben.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition active:scale-95"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
