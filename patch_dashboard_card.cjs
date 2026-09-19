const fs = require('fs');
const file = 'components/Dashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

// The mobile layout around line 2990 has:
//               <div className="bg-slate-50/50 p-2 sm:p-3 space-y-3 relative z-10 flex-1 overflow-y-auto">
//                 {/* ... */}
//                 <div className="bg-white p-3 rounded-xl border border-slate-200 grid grid-cols-2 gap-3 shrink-0">
//                   <div>
//                     <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">

// Desktop layout around line 4150:
//                     <div className="bg-white p-4 rounded-2xl border border-slate-200 grid grid-cols-2 gap-4 shrink-0 shadow-sm relative z-20">
//                       <div>
//                         <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
//                           Ab

const venueVars = `
  const venuePhoto = settings?.facilityPhotoUrl || settings?.headerLogoUrl || settings?.customLogoUrl || settings?.logoUrl || "";
  const venueClubName = settings?.clubName || "Verein";
  const displayAddress = (settings?.street && settings?.city) 
    ? \`\${settings.street}, \${settings.zip || ''} \${settings.city}\` 
    : "Keine Adresse hinterlegt";
  const mapsUrl = (settings?.street && settings?.city)
    ? \`https://www.google.com/maps/search/?api=1&query=\${encodeURIComponent(settings.street + ', ' + (settings.zip || '') + ' ' + settings.city)}\`
    : \`https://www.google.com/maps/search/?api=1&query=\${encodeURIComponent(venueClubName)}\`;
`;

// Mobile
const mobileTarget = /<div className="bg-white p-3 rounded-xl border border-slate-200 grid grid-cols-2 gap-3 shrink-0">/g;
const mobileCard = `
                {/* Austragungsort Card */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm shrink-0">
                  <div className="h-24 w-full relative bg-slate-200 overflow-hidden">
                    <img
                      src={venuePhoto}
                      alt="Austragungsort Anlage"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent flex items-end p-2.5">
                      <div className="text-white min-w-0">
                        <div className="text-[9px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 leading-none mb-1">
                          <i className="fa-solid fa-location-dot"></i>
                          Austragungsort
                        </div>
                        <div className="text-xs font-black truncate drop-shadow-sm text-white">
                          {venueClubName}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 space-y-3">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold overflow-hidden">
                      <i className="fa-solid fa-map-pin text-[var(--color-primary)] text-xs shrink-0"></i>
                      <span className="truncate">{displayAddress}</span>
                    </div>
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition-colors border border-slate-200 shadow-2xs hover:text-[var(--color-primary)] cursor-pointer"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
                      In Google Maps öffnen
                    </a>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 grid grid-cols-2 gap-3 shrink-0">`;

// Desktop
const desktopTarget = /<div className="bg-white p-4 rounded-2xl border border-slate-200 grid grid-cols-2 gap-4 shrink-0 shadow-sm relative z-20">/g;
const desktopCard = `
                    {/* Austragungsort Card */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm shrink-0">
                      <div className="h-28 w-full relative bg-slate-200 overflow-hidden">
                        <img
                          src={venuePhoto}
                          alt="Austragungsort Anlage"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent flex items-end p-3">
                          <div className="text-white min-w-0">
                            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 leading-none mb-1">
                              <i className="fa-solid fa-location-dot"></i>
                              Austragungsort
                            </div>
                            <div className="text-sm font-black truncate drop-shadow-sm text-white">
                              {venueClubName}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 flex items-center justify-between gap-4">
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs text-slate-500 font-bold overflow-hidden">
                            <i className="fa-solid fa-map-pin text-[var(--color-primary)] shrink-0"></i>
                            <span className="truncate">{displayAddress}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-semibold mt-1">
                            {selectedSlot.court} • Treffpunkt vor Ort
                          </div>
                        </div>
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition-colors border border-slate-200 shrink-0 shadow-2xs hover:text-[var(--color-primary)] cursor-pointer"
                        >
                          <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                          In Google Maps
                        </a>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 grid grid-cols-2 gap-4 shrink-0 shadow-sm relative z-20">`;


if (!code.includes('Austragungsort Card')) {
  // Inject variables at the beginning of the component
  const hookTarget = `const canBookHobbyLeague = isLeagueEnabledInClub && hasHobbyLeagueOptIn;`;
  code = code.replace(hookTarget, hookTarget + '\\n' + venueVars);
  
  // Replace mobile layout
  code = code.replace(mobileTarget, mobileCard);
  
  // Replace desktop layout
  code = code.replace(desktopTarget, desktopCard);
  
  fs.writeFileSync(file, code);
  console.log("Patched Dashboard.tsx with Austragungsort card");
} else {
  console.log("Already patched");
}
