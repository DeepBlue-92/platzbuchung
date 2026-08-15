const fs = require('fs');
let content = fs.readFileSync('components/SuperAdminDashboard.tsx', 'utf8');

// 1. Add checkLeagueMergeConflicts import
if (!content.includes('checkLeagueMergeConflicts')) {
  content = content.replace(
    /import \{ mergePersons, ignoreDuplicatePair \} from "\.\.\/services\/duplicateDetection";/g,
    'import { mergePersons, ignoreDuplicatePair } from "../services/duplicateDetection";\nimport { checkLeagueMergeConflicts } from "../services/league";'
  );
}

// 2. Add state for mergeConfirmData
if (!content.includes('mergeConfirmData')) {
  content = content.replace(
    /const \[pairMergeTargets, setPairMergeTargets\] = useState<Record<string, string>>\(\{\}\);/g,
    'const [pairMergeTargets, setPairMergeTargets] = useState<Record<string, string>>({});\n  const [mergeConfirmData, setMergeConfirmData] = useState<{pair: DuplicatePair, targetId: string, conflictCount: number} | null>(null);'
  );
}

// 3. Add handlePreCheckMerge function
if (!content.includes('handlePreCheckMerge')) {
  content = content.replace(
    /const handleExecuteMerge = async/g,
    `const handlePreCheckMerge = async (pair: DuplicatePair, targetId: string) => {
    setMergeLoadingId(pair.id);
    try {
      const sourceId = pair.personA.id === targetId ? pair.personB.id : pair.personA.id;
      const count = await checkLeagueMergeConflicts(targetId, sourceId);
      if (count > 0) {
        setMergeConfirmData({ pair, targetId, conflictCount: count });
      } else {
        await handleExecuteMerge(pair, targetId);
      }
    } catch(e: any) {
      alert("Fehler bei der Konfliktprüfung: " + e.message);
    } finally {
      setMergeLoadingId(null);
    }
  };

  const handleExecuteMerge = async`
  );
}

// 4. Update the onClick for the button
content = content.replace(
  /onClick=\{\(\) => handleExecuteMerge\(pair, pairMergeTargets\[pair\.id\] \|\| pair\.personA\.id\)\}/g,
  'onClick={() => handlePreCheckMerge(pair, pairMergeTargets[pair.id] || pair.personA.id)}'
);

// 5. Add dialog markup at the end of the return statement (before last closing div)
const dialogMarkup = `
      {mergeConfirmData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-amber-50 border-b border-amber-100 p-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0">
                <i className="fa-solid fa-triangle-exclamation text-xl"></i>
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-lg">Achtung: Konfligierende Matches</h3>
                <p className="text-sm text-slate-600 leading-relaxed mt-1">
                  <strong className="text-amber-700">{mergeConfirmData.conflictCount} Matches</strong> zwischen beiden Profilen werden bei der Zusammenführung annulliert.
                </p>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setMergeConfirmData(null)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={async () => {
                  const data = mergeConfirmData;
                  setMergeConfirmData(null);
                  await handleExecuteMerge(data.pair, data.targetId);
                }}
                className="px-4 py-2 rounded-xl text-sm font-black text-white bg-[#1b4332] hover:bg-[#153326] transition-colors shadow-sm"
              >
                Trotzdem zusammenführen
              </button>
            </div>
          </div>
        </div>
      )}
`;

if (!content.includes('mergeConfirmData && (')) {
  content = content.replace(
    /    <\/div>\s*<\/div>\s*$/g,
    dialogMarkup + '    </div>\n  </div>\n'
  );
}

fs.writeFileSync('components/SuperAdminDashboard.tsx', content);
