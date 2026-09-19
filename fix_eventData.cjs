const fs = require('fs');
let file = 'components/AdminSettings.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/date: eventDate \|\| undefined,/g, 'date: eventDate || null,');
content = content.replace(/startTime: eventStartTime \|\| undefined,/g, 'startTime: eventStartTime || null,');
content = content.replace(/endTime: eventEndTime \|\| undefined,/g, 'endTime: eventEndTime || null,');
content = content.replace(/description: eventDescription\.trim\(\) \|\| undefined,/g, 'description: eventDescription.trim() || null,');
content = content.replace(/: undefined,/g, ': null,'); // maxParticipants and isRegistrationBlocked
content = content.replace(/isRegistrationBlocked: eventIsRegistrationBlocked \|\| undefined,/g, 'isRegistrationBlocked: eventIsRegistrationBlocked || null,');
fs.writeFileSync(file, content, 'utf8');
console.log('Fixed undefined in eventData in', file);
