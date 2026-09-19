const fs = require('fs');
const file = 'components/hobbyliga/HobbyligaBookingDrawer.tsx';
if (fs.existsSync(file)) {
  let code = fs.readFileSync(file, 'utf8');

  const importRegex = /import React, \{ useState, useEffect, useMemo \} from 'react';/;
  code = code.replace(importRegex, `import React, { useState, useEffect, useMemo } from 'react';\nimport { listenToReservationRules } from '../../lib/firebase';`);

  const hookRegex = /const currentDuration = getDurationInHours\(modalStartTime, endTime\);/;
  const rulesCode = `
  const [reservationRules, setReservationRules] = useState<any>(null);
  useEffect(() => {
    if (!clubId) return;
    const unsub = listenToReservationRules(clubId, setReservationRules);
    return () => unsub();
  }, [clubId]);

  const currentDuration = getDurationInHours(modalStartTime, endTime);
`;
  if (!code.includes('listenToReservationRules(clubId')) {
    code = code.replace(hookRegex, rulesCode);
  }

  const targetOptions = /const leagueEndTimeOptions = useMemo\(\(\) => \{[\s\S]*?\}, \[modalStartTime\]\);/g;
  const replacementOptions = `const leagueEndTimeOptions = useMemo(() => {
    const startIdx = TIME_SLOTS.indexOf(modalStartTime);
    if (startIdx < 0) return [];

    let closingIdx = TIME_SLOTS.length - 1;
    if (slot?.date && reservationRules?.openingHours) {
      const weekday = new Date(slot.date).getDay();
      const dayRule = reservationRules.openingHours[String(weekday)];
      if (dayRule && dayRule.end && !dayRule.closed) {
        const idx = TIME_SLOTS.indexOf(dayRule.end);
        if (idx !== -1) closingIdx = idx;
      }
    }

    const options: string[] = [];
    const idx2h = startIdx + 2;
    if (idx2h <= closingIdx) options.push(TIME_SLOTS[idx2h]);
    const idx3h = startIdx + 3;
    if (idx3h <= closingIdx) options.push(TIME_SLOTS[idx3h]);
    
    // If no 2h or 3h option fits before closing, provide the closing time itself if it's > start
    if (options.length === 0 && closingIdx > startIdx) {
      options.push(TIME_SLOTS[closingIdx]);
    }

    return options;
  }, [modalStartTime, slot?.date, reservationRules?.openingHours]);`;

  code = code.replace(targetOptions, replacementOptions);

  const targetAutoSet = /const startIdx = TIME_SLOTS.indexOf\(newStart\);\s*if \(TIME_SLOTS.indexOf\(endTime\) <= startIdx\) \{\s*setEndTime\(TIME_SLOTS\[startIdx \+ 2\] \|\| TIME_SLOTS\[TIME_SLOTS.length - 1\]\);\s*\}/g;
  const replacementAutoSet = `const startIdx = TIME_SLOTS.indexOf(newStart);
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
                        setEndTime(TIME_SLOTS[endIdx] || TIME_SLOTS[TIME_SLOTS.length - 1]);`;
  
  // Actually, I need to check how it's handled in onChange for Ab:
  // "onChange={(e) => { ... setEndTime(TIME_SLOTS[startIdx + 2] || TIME_SLOTS[TIME_SLOTS.length - 1]); }}"
  // Let me just replace the whole onChange inside HobbyligaBookingDrawer.

  fs.writeFileSync(file, code);
  console.log("Patched league endTime options in HobbyligaBookingDrawer");
} else {
  console.log("File not found");
}
