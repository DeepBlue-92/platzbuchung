const fs = require('fs');
let file = 'components/Tournaments.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/date: formData\.date \|\| undefined,/g, 'date: formData.date || null,');
content = content.replace(/startTime: formData\.startTime \|\| undefined,/g, 'startTime: formData.startTime || null,');
content = content.replace(/endTime: formData\.endTime \|\| undefined,/g, 'endTime: formData.endTime || null,');
content = content.replace(/description: formData\.description\.trim\(\) \|\| undefined,/g, 'description: formData.description.trim() || null,');
content = content.replace(/: undefined,/g, ': null,'); // maxParticipants
content = content.replace(/isRegistrationBlocked: formData\.isRegistrationBlocked \|\| undefined,/g, 'isRegistrationBlocked: formData.isRegistrationBlocked || null,');
fs.writeFileSync(file, content, 'utf8');
console.log('Fixed undefined in Tournaments in', file);
