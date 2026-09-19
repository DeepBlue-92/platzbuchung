const fs = require('fs');
const file = 'components/AdminSettings.tsx';
let code = fs.readFileSync(file, 'utf8');

const regex = /onUpdateSettings\(\{\s*\.\.\.settings,\s*clubName,\s*street,\s*zip,\s*city,\s*modules,\s*\}\);/g;
const replacement = `onUpdateSettings({
        ...settings,
        clubName,
        street,
        zip,
        city,
        facilityPhotoUrl: customFacilityPhotoUrl,
        modules,
      });`;
code = code.replace(regex, replacement);

fs.writeFileSync(file, code);
console.log("Patched handleSaveTab for facilityPhotoUrl");
