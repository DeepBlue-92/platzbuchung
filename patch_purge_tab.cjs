const fs = require('fs');
const file = 'components/SuperAdminUserPurgeTab.tsx';
let code = fs.readFileSync(file, 'utf8');

const importTarget = `import { useState, useMemo } from "react";`;
const importReplacement = `import { useState, useMemo } from "react";\nimport SuperAdminCreateUserModal from "./SuperAdminCreateUserModal";`;
if (!code.includes('SuperAdminCreateUserModal')) {
  code = code.replace(importTarget, importReplacement);
}

const headerTarget = `      {/* Toast Notification */}`;
const headerReplacement = `      {/* Header Actions */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-black text-[#1b4332] uppercase tracking-wider">Benutzerverwaltung</h2>
        <button
          onClick={() => setShowCreateUserModal(true)}
          className="px-4 py-2.5 bg-[#1b4332] hover:bg-emerald-900 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
        >
          <i className="fa-solid fa-user-plus"></i> Neuen Benutzer anlegen
        </button>
      </div>

      {showCreateUserModal && (
        <SuperAdminCreateUserModal 
          onClose={() => setShowCreateUserModal(false)}
          clubs={clubs}
          onUserCreated={() => {
            setShowCreateUserModal(false);
            showToast("Benutzer erfolgreich angelegt", "success");
            // The list will update automatically via Firebase listener
          }}
        />
      )}

      {/* Toast Notification */}`;

if (!code.includes('setShowCreateUserModal(true)')) {
  code = code.replace(headerTarget, headerReplacement);
}

const stateTarget = `  const [assignClubForm, setAssignClubForm] = useState<{`;
const stateReplacement = `  const [showCreateUserModal, setShowCreateUserModal] = useState(false);\n  const [assignClubForm, setAssignClubForm] = useState<{`;

if (!code.includes('showCreateUserModal')) {
  code = code.replace(stateTarget, stateReplacement);
}

fs.writeFileSync(file, code);
console.log("Patched SuperAdminUserPurgeTab");
