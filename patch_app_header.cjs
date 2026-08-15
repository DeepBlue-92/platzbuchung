const fs = require('fs');

let appContent = fs.readFileSync('App.tsx', 'utf8');

// Match everything from {/* Mobile-only Header */} down to the closing </div>
const regex = /\{\/\*\s*Mobile-only Header\s*\*\/\}\s*<div className="lg:hidden[^>]+>[\s\S]*?<\/div>\s*<h3[^>]+>[\s\S]*?<\/h3>\s*<button[\s\S]*?<\/button>\s*<\/div>/g;

// Instead, let's just do a simpler replace. 
// We know it starts with `{/* Mobile-only Header */}`
// It's followed by a div, an h3, a button, and the closing div of the header.
// Let's use a while loop with indexOf
let index = appContent.indexOf('{/* Mobile-only Header */}');
while(index !== -1) {
  const endButton = appContent.indexOf('Zurück', index);
  const endDiv = appContent.indexOf('</div>', endButton) + 6;
  appContent = appContent.substring(0, index) + appContent.substring(endDiv);
  index = appContent.indexOf('{/* Mobile-only Header */}');
}

fs.writeFileSync('App.tsx', appContent);
