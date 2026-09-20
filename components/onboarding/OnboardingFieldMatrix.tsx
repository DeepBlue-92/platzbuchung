import React from "react";
import {
  ClubOnboardingSettings,
  OnboardingFieldPermission,
  OnboardingPasswordFieldPermission,
} from "../../types";

interface OnboardingFieldMatrixProps {
  config: ClubOnboardingSettings;
  onChange: (key: keyof ClubOnboardingSettings, value: any) => void;
}

export const OnboardingFieldMatrix: React.FC<OnboardingFieldMatrixProps> = ({
  config,
  onChange,
}) => {
  return (
    <div className="bg-slate-50 p-6 sm:p-8 rounded-[1rem] border border-slate-100 space-y-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-4">
        <h3 className="text-sm font-black text-[var(--color-primary)] uppercase flex items-center gap-2">
          <i className="fa-solid fa-table-cells"></i>{" "}
          Feld-Berechtigungsmatrix
        </h3>
        <span className="text-[10px] text-slate-500 font-bold uppercase">
          Bestimmt, wie jedes Bento-Feld dem Mitglied dargestellt wird
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Field 1: Name */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Vorname & Nachname
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Klarname des Mitglieds
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
            {(["HIDDEN", "READ_ONLY", "EDITABLE"] as OnboardingFieldPermission[]).map(
              (perm) => (
                <button
                  key={perm}
                  type="button"
                  onClick={() => onChange("field_name", perm)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                    config.field_name === perm
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {perm === "HIDDEN"
                    ? "Ausgeblendet"
                    : perm === "READ_ONLY"
                    ? "Nur Lesen"
                    : "Bearbeitbar"}
                </button>
              )
            )}
          </div>
        </div>

        {/* Field 2: Demographics */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Demographie
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Geburtsdatum und Geschlecht
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
            {(["HIDDEN", "READ_ONLY", "EDITABLE"] as OnboardingFieldPermission[]).map(
              (perm) => (
                <button
                  key={perm}
                  type="button"
                  onClick={() => onChange("field_demographics", perm)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                    config.field_demographics === perm
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {perm === "HIDDEN"
                    ? "Ausgeblendet"
                    : perm === "READ_ONLY"
                    ? "Nur Lesen"
                    : "Bearbeitbar"}
                </button>
              )
            )}
          </div>
        </div>

        {/* Field 3: Avatar */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Profilbild & Avatar-Icon
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Avatar-Uploader oder Vektor-Icon
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
            {(["HIDDEN", "READ_ONLY", "EDITABLE"] as OnboardingFieldPermission[]).map(
              (perm) => (
                <button
                  key={perm}
                  type="button"
                  onClick={() => onChange("field_avatar", perm)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                    config.field_avatar === perm
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {perm === "HIDDEN"
                    ? "Ausgeblendet"
                    : perm === "READ_ONLY"
                    ? "Nur Lesen"
                    : "Bearbeitbar"}
                </button>
              )
            )}
          </div>
        </div>

        {/* Field 4: Password */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Passwort festlegen
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Optionale Passwortänderung im Onboarding
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
            {(["HIDDEN", "EDITABLE"] as OnboardingPasswordFieldPermission[]).map(
              (perm) => (
                <button
                  key={perm}
                  type="button"
                  onClick={() => onChange("field_password", perm)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                    config.field_password === perm
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {perm === "HIDDEN" ? "Ausgeblendet" : "Bearbeitbar"}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
