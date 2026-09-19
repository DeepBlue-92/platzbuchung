const fs = require('fs');
const file = 'App.tsx';
let code = fs.readFileSync(file, 'utf8');

const target1 = `  const uniqueUserClubs = useMemo(() => {`;
const replacement1 = `  const uniqueUserClubsRaw = useMemo(() => {`;

const target2 = `        return nameA.localeCompare(nameB, 'de', { sensitivity: 'base' });
      });
  }, [userClubs, currentUser?.clubs, proxyUser?.clubs]);`;
const replacement2 = `        return nameA.localeCompare(nameB, 'de', { sensitivity: 'base' });
      });
  }, [userClubs, currentUser?.clubs, proxyUser?.clubs]);

  const uniqueUserClubs = useMemo(() => {
    if (superAdminContext || currentUser?.role === 'super-admin') return uniqueUserClubsRaw;
    if (currentUser?.role === 'admin') return [];
    if (!proxyUser && uniqueUserClubsRaw.length > 1) return uniqueUserClubsRaw;
    return [];
  }, [uniqueUserClubsRaw, currentUser?.role, superAdminContext, proxyUser]);`;

code = code.replace(target1, replacement1);
code = code.replace(target2, replacement2);
fs.writeFileSync(file, code);
console.log("Patched uniqueUserClubs in App.tsx");
