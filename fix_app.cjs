const fs = require('fs');

let content = fs.readFileSync('App.tsx', 'utf8');

// 1. Extract the bad logic from JSX
const badLogicStart = content.indexOf('  let mobileHeaderTitle = "";');
const badLogicEnd = content.indexOf('          {window.innerWidth < 1024');

const extractedLogic = content.substring(badLogicStart, badLogicEnd);

// Remove the extracted logic from JSX
content = content.replace(extractedLogic, '');

// 2. Insert the logic before the `return (`
const returnIndex = content.indexOf('  return (\n    <>\n      <style>');
content = content.substring(0, returnIndex) + extractedLogic + '\n' + content.substring(returnIndex);

fs.writeFileSync('App.tsx', content);
