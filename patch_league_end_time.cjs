const fs = require('fs');
const file = 'components/Dashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

const targetOptions = /const leagueEndTimeOptions = useMemo\(\(\) => \{[\s\S]*?\}, \[modalStartTime, getDurationInHours\]\);/g;

const replacementOptions = `const leagueEndTimeOptions = useMemo(() => {
    if (!modalStartTime) return [];
    const startIdx = TIME_SLOTS.indexOf(modalStartTime);
    if (startIdx === -1) return [];

    let closingIdx = TIME_SLOTS.length - 1;
    if (selectedSlot?.date && reservationRules?.openingHours) {
      const weekday = new Date(selectedSlot.date).getDay();
      const dayRule = reservationRules.openingHours[String(weekday)];
      if (dayRule && dayRule.end && !dayRule.closed) {
        const idx = TIME_SLOTS.indexOf(dayRule.end);
        if (idx !== -1) closingIdx = idx;
      }
    }

    const validSlots = TIME_SLOTS.slice(startIdx + 1, closingIdx + 1).filter((t) => {
      const dur = getDurationInHours(modalStartTime, t);
      return dur >= 2 && dur <= 3;
    });

    if (validSlots.length > 0) {
      return validSlots;
    }
    return TIME_SLOTS.slice(startIdx + 1, closingIdx + 1);
  }, [modalStartTime, getDurationInHours, selectedSlot?.date, reservationRules?.openingHours]);`;

code = code.replace(targetOptions, replacementOptions);

// Fix the auto-set logic for Liga dropdowns
const targetAutoSet = /const endIdx = Math\.min\(TIME_SLOTS\.length - 1, startIdx \+ 2\);\s*setEndTime\(TIME_SLOTS\[endIdx\]\);/g;
const replacementAutoSet = `let maxEndIdx = TIME_SLOTS.length - 1;
                              if (selectedSlot?.date && reservationRules?.openingHours) {
                                const weekday = new Date(selectedSlot.date).getDay();
                                const dayRule = reservationRules.openingHours[String(weekday)];
                                if (dayRule && dayRule.end && !dayRule.closed) {
                                  const idx = TIME_SLOTS.indexOf(dayRule.end);
                                  if (idx !== -1) maxEndIdx = idx;
                                }
                              }
                              const endIdx = Math.min(maxEndIdx, startIdx + 2);
                              setEndTime(TIME_SLOTS[endIdx]);`;

code = code.replace(targetAutoSet, replacementAutoSet);

// Next: "Entferne das gelbe Badge '2-3 std. match' oben rechts im Liga-Header des Sliders"
// This occurs in the Dashboard League header where we see the trophy icon and "HOBBYLIGA". Wait, did we find it in Dashboard?
// Let's check if there is a badge.

fs.writeFileSync(file, code);
console.log("Patched league endTime options");
