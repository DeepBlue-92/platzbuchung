const fs = require('fs');
const file = 'components/hobbyliga/HobbyligaBookingDrawer.tsx';
let code = fs.readFileSync(file, 'utf8');

const target1 = /if \(startIdx >= 0\) \{\s*const endIdx = Math.min\(TIME_SLOTS.length - 1, startIdx \+ 2\);\s*setEndTime\(TIME_SLOTS\[endIdx\]\);\s*\}/g;
const replacement1 = `if (startIdx >= 0) {
                        let closingIdx = TIME_SLOTS.length - 1;
                        if (slot?.date && reservationRules?.openingHours) {
                          const weekday = new Date(slot.date).getDay();
                          const dayRule = reservationRules.openingHours[String(weekday)];
                          if (dayRule && dayRule.end && !dayRule.closed) {
                            const idx = TIME_SLOTS.indexOf(dayRule.end);
                            if (idx !== -1) closingIdx = idx;
                          }
                        }
                        const endIdx = Math.min(closingIdx, startIdx + 2);
                        setEndTime(TIME_SLOTS[endIdx]);
                      }`;
                      
code = code.replace(target1, replacement1);

// also fix the useEffect one at the top
const target2 = /const startIdx = TIME_SLOTS\.indexOf\(slot\.startTime\);\s*if \(startIdx >= 0 && startIdx \+ 2 < TIME_SLOTS\.length\) \{\s*setEndTime\(TIME_SLOTS\[startIdx \+ 2\]\);\s*\}/g;
const replacement2 = `const startIdx = TIME_SLOTS.indexOf(slot.startTime);
      if (startIdx >= 0) {
        let closingIdx = TIME_SLOTS.length - 1;
        if (slot?.date && reservationRules?.openingHours) {
          const weekday = new Date(slot.date).getDay();
          const dayRule = reservationRules.openingHours[String(weekday)];
          if (dayRule && dayRule.end && !dayRule.closed) {
            const idx = TIME_SLOTS.indexOf(dayRule.end);
            if (idx !== -1) closingIdx = idx;
          }
        }
        const endIdx = Math.min(closingIdx, startIdx + 2);
        setEndTime(TIME_SLOTS[endIdx]);
      }`;
code = code.replace(target2, replacement2);

fs.writeFileSync(file, code);
console.log("Patched HobbyligaBookingDrawer setEndTime");
