const fs = require('fs');
let file = 'components/AdminSettings.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/birthDate: editingUser\.birthDate \? editingUser\.birthDate\.trim\(\) : undefined,/g, 'birthDate: editingUser.birthDate ? editingUser.birthDate.trim() : null,');
content = content.replace(/birthDate: parts\[8\]\?\.trim\(\) \|\| undefined/g, 'birthDate: parts[8]?.trim() || null');
fs.writeFileSync(file, content, 'utf8');
console.log('Fixed birthDate in', file);
