const fs = require('fs');

function replaceUndefined(file) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // replace tb1: undefined with tb1: null
  content = content.replace(/as number : undefined/g, 'as number : null');
  content = content.replace(/tb1\?: number/g, 'tb1?: number | null');
  content = content.replace(/tb2\?: number/g, 'tb2?: number | null');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed undefined in', file);
  }
}

['components/LeagueResultDrawer.tsx', 'components/SuperAdminPendingMatchesWidget.tsx'].forEach(replaceUndefined);
