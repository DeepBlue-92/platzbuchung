const fs = require('fs');
const acorn = require('acorn');
const jsx = require('acorn-jsx');
const parser = acorn.Parser.extend(jsx());
const code = fs.readFileSync('components/AdminSettings.tsx', 'utf8');

try {
  parser.parse(code, { sourceType: 'module', ecmaVersion: 2020 });
  console.log("Parse successful");
} catch (e) {
  console.error("Parse error at line", e.loc.line, "col", e.loc.column);
  console.error(e.message);
}
