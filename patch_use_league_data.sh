#!/bin/bash
awk '
BEGIN { in_block = 0 }
NR==42 {
    print "import { useLeagueData } from '"'"'../hooks/useLeagueData'"'"';"
}
NR>=60 && NR<=126 {
    if (!in_block) {
        print "  const {"
        print "    profile,"
        print "    allProfiles,"
        print "    matches,"
        print "    allClubMatches,"
        print "    partnerSearches,"
        print "    activeConfig,"
        print "    loading,"
        print "    hasOptedIn,"
        print "    activeLeagues,"
        print "    activeLeagueId,"
        print "    setActiveLeagueId,"
        print "    refreshPartnerSearches,"
        print "    handleJoinLeague,"
        print "    setPartnerSearches,"
        print "  } = useLeagueData(currentUser, clubId, settings);"
        in_block = 1
    }
    next
}
NR>=134 && NR<=183 {
    next
}
NR>=186 && NR<=192 {
    next
}
NR>=221 && NR<=236 {
    next
}
{ print }
' components/LeagueDashboard.tsx > components/LeagueDashboard.tsx.tmp
mv components/LeagueDashboard.tsx.tmp components/LeagueDashboard.tsx
