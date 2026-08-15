const fs = require('fs');
let content = fs.readFileSync('services/duplicateDetection.ts', 'utf8');
content = content.replace(
  /\/\/ 4\. Delete source person document/g,
  "// 3.5 Merge league profiles\n    await mergeLeagueProfiles(targetPersonId, sourcePersonId);\n\n    // 4. Delete source person document"
);
fs.writeFileSync('services/duplicateDetection.ts', content);
