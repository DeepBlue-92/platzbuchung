const fs = require('fs');
const file = 'components/hobbyliga/HobbyligaBookingDrawer.tsx';
if (fs.existsSync(file)) {
  let code = fs.readFileSync(file, 'utf8');
  
  const regex1 = /<span className="text-\[10px\] font-bold text-amber-700 bg-amber-200\/60 px-1\.5 py-0\.5 rounded lowercase tracking-normal">\s*2–3 Std\. Match\s*<\/span>/g;
  const regex2 = /<span className="text-\[10px\] font-bold text-amber-700\/80 bg-amber-200\/60 px-2 py-0\.5 rounded-md lowercase tracking-normal">\s*2–3 Std\. Match\s*<\/span>/g;
  
  code = code.replace(regex1, '');
  code = code.replace(regex2, '');
  
  fs.writeFileSync(file, code);
  console.log("Removed yellow badge in HobbyligaBookingDrawer");
} else {
  console.log("File not found");
}
