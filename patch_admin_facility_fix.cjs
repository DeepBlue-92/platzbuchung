const fs = require('fs');
const file = 'components/AdminSettings.tsx';
let code = fs.readFileSync(file, 'utf8');

const regex = /handleImageUpload\(file, "facility"\);/g;
code = code.replace(regex, `handleImageUpload(e as any, "facilityPhoto");`);

fs.writeFileSync(file, code);
console.log("Patched handleImageUpload for facilityPhoto");
