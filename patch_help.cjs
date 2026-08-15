const fs = require('fs');

function patchFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  let start = content.indexOf('{/* Mobile-only Header */}');
  if (start !== -1) {
    let end = content.indexOf('</div>', content.indexOf('Zurück', start)) + 6;
    content = content.substring(0, start) + content.substring(end);
    fs.writeFileSync(file, content);
  }
}

patchFile('components/Help.tsx');
patchFile('components/Impressum.tsx');
