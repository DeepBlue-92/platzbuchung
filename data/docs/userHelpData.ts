export interface HelpArticle {
  id: string;
  title: string;
  summary: string;
  content: string; // Markdown formatted text
  keywords: string[];
}

export interface HelpCategory {
  id: string;
  title: string;
  iconName: string;
  description: string;
  articles: HelpArticle[];
}

export const USER_HELP_CATEGORIES: HelpCategory[] = [
  {
    id: 'platz-buchen-stornieren',
    title: 'Platz buchen & stornieren',
    iconName: 'Calendar',
    description: 'Alles rund um Reservierungen, Spielzeiten, Tages- und Wochenplan sowie Stornierungen.',
    articles: [
      {
        id: 'wie-buche-ich',
        title: 'Wie buche ich einen Tennisplatz?',
        summary: 'In wenigen Schritten vom Belegungsplan zur verbindlichen Reservierung.',
        keywords: ['buchen', 'reservieren', 'platz', 'zeitfenster', 'uhrzeit', 'slot'],
        content: `### Platzreservierung Schritt für Schritt

1. **Belegungsplan öffnen:** Wähle in der Navigation die **Reservierung** aus.
2. **Tag & Zeit auswählen:** Klicke im Wochen- oder Tagesplan auf ein freies, weißes Zeitfenster des gewünschten Platzes.
3. **Spielart & Partner festlegen:** Es öffnet sich der Buchungs-Slider. Wähle aus, ob du ein **Einzel** (1 Mitspieler) oder **Doppel** (3 Mitspieler) spielen möchtest.
4. **Partner auswählen:** Tippe den Namen deines Mitspielers in das Suchfeld ein und wähle ihn aus der Liste aus.
5. **Reservierung bestätigen:** Klicke unten auf **„Jetzt buchen“**. Der Platz ist sofort für dich und deine Partner reserviert und wird farbig im Kalender angezeigt.`
      },
      {
        id: 'tages-vs-wochenplan',
        title: 'Tagesplan vs. Wochenplan (Mobil vs. Computer)',
        summary: 'Optimale Übersicht auf Smartphone und Desktop-Bildschirm.',
        keywords: ['ansicht', 'smartphone', 'mobil', 'wochenplan', 'tagesplan', 'wechseln', 'bento'],
        content: `### Flexible Kalenderansichten & Desktop Bento-Design

- **Auf dem Smartphone / Mobilgerät:** Das System öffnet standardmäßig den übersichtlichen **Tagesplan**. Hier siehst du alle Plätze nebeneinander im direkten Stundenraster von morgens bis abends.
- **Am Computer / Desktop:** Hier startet standardmäßig der **Wochenplan**, der dir die gesamten 7 Wochentage auf einen Blick darstellt. Alle Hauptseiten (Hobbyliga, Platzbuchung, Veranstaltungen, Rangliste) sind in einem bündigen Bento-Grid-Layout mit einheitlichen, gleichmäßigen Abständen (16–20px) aufgebaut.
- **Ansicht manuell wechseln:** Du kannst jederzeit über die Menüleiste zwischen **Tagesansicht** und **Wochenansicht** umschalten oder über den Datumswähler beliebige Tage in der Zukunft ansteuern.
- **Wischgesten (Mobil):** Auf Smartphones und Tablets kannst du einfach nach links oder rechts wischen, um zuverlässig und flüssig zum nächsten bzw. vorherigen Tag oder zur nächsten bzw. vorherigen Woche zu navigieren. Auch im Monatskalender kannst du durch einfaches Wischen komfortabel zwischen den Monaten blättern.`
      },
      {
        id: 'stornierung',
        title: 'Wie storniere ich eine Buchung?',
        summary: 'Buchung ganz einfach freigeben, falls ein Spiel nicht stattfinden kann.',
        keywords: ['stornieren', 'löschen', 'absagen', 'rückgängig', 'freigeben'],
        content: `### Buchung stornieren

Falls du oder deine Mitspieler verhindert seid, storniere den Platz bitte rechtzeitig, damit andere Clubmitglieder spielen können:

1. Klicke im Belegungsplan direkt auf deine **bereits bestehende Buchung**.
2. Im geöffneten Detail-Fenster findest du den roten Button **„Buchung stornieren“**.
3. Bestätige die Sicherheitsabfrage.
4. Der Zeitslot wird sofort wieder freigegeben und steht allen Mitgliedern zur Verfügung.

*Hinweis:* Stornierungen sind bis kurz vor Spielbeginn möglich. Vergangene Spielstunden können nicht mehr storniert werden.`
      },
      {
        id: 'buchungsregeln-fristen',
        title: 'Buchungsfristen & Buchungsbeschränkungen',
        summary: 'Wie viele Tage im Voraus und wie oft darf gebucht werden?',
        keywords: ['frist', 'vorausbuchung', 'maximum', 'limit', 'parallel', 'stunden'],
        content: `### Fairplay & Buchungsregeln

Um allen Mitgliedern faire Spielmöglichkeiten zu garantieren, gelten clubweit folgende Grundregeln:
- **Vorausbuchungsfrist:** Plätze können typischerweise bis zu mehreren Tagen im Voraus gebucht werden (entsprechend der Vereinseinstellungen).
- **Parallele Buchungen:** Jedes Mitglied darf zeitgleich nur eine begrenzte Anzahl aktiver Buchungen im Voraus besitzen. Sobald deine gebuchte Spielzeit vorüber ist, kannst du direkt den nächsten Termin reservieren.
- **Spieldauer:** Die reguläre Buchungsdauer beträgt in der Regel 60 Minuten (Einzel) bzw. bis zu 120 Minuten (Doppel).`
      },
      {
        id: 'schlechtes-wetter-platzpflege',
        title: 'Schlechtes Wetter, Regen & Platzpflege',
        summary: 'Verhalten bei Nässe, Gewitter und das richtige Abziehen der Plätze.',
        keywords: ['regen', 'wetter', 'platzpflege', 'sperre', 'abziehen', 'wässern', 'sandplatz'],
        content: `### Platzpflege & Witterung

- **Bei oder nach starkem Regen:** Steht Wasser auf den Sandplätzen oder ist der Boden weich, darf der Platz auf keinen Fall bespielt werden. Pfützen dürfen keinesfalls mit Besen oder Schleppnetzen weggeschoben werden, da sonst die feine Ziegelmehldecke abgetragen wird!
- **Plätze abziehen:** Nach jedem Match muss der Sandplatz kreisförmig von außen nach innen komplett bis zu den Zäunen abgezogen werden.
- **Linien fegen:** Die Linien bitte anschließend mit dem Linienbesen säubern.
- **Wässern:** Bei trockenem Wetter vor und nach dem Spiel die Plätze gründlich beregnen.`
      }
    ]
  },
  {
    id: 'mitspieler-gaeste',
    title: 'Mitspieler & Gäste einladen',
    iconName: 'Users',
    description: 'Partner finden, Gastspieler mitbringen, Doppel-Matches organisieren und Hobbyliga.',
    articles: [
      {
        id: 'mitspieler-auswaehlen',
        title: 'Mitspieler auswählen & suchen',
        summary: 'So fügst du andere Clubmitglieder zu deiner Buchung hinzu.',
        keywords: ['mitspieler', 'partner', 'suche', 'name', 'liste', 'auswählen'],
        content: `### Mitspieler hinzufügen

Im Buchungsdialog kannst du deine Mitspieler bequem über ein Schnellsuche-Feld finden:
1. Beginne den Nachnamen oder Vornamen deines Partners in das Suchfeld einzutippen.
2. Das System filtert in Echtzeit alle aktiven Vereinsmitglieder.
3. Klicke auf den gewünschten Namen, um ihn als Spieler 2 (oder Spieler 3 und 4 beim Doppel) zu übernehmen.
4. Alle eingetragenen Mitspieler sehen die Buchung sofort in ihrer persönlichen Übersicht.`
      },
      {
        id: 'mit-gaesten-spielen',
        title: 'Mit Gastspielern (Nicht-Mitgliedern) spielen',
        summary: 'Freunde, Verwandte oder externe Tennisspieler einladen und abrechnen.',
        keywords: ['gast', 'gäste', 'gastspieler', 'extern', 'gebühr', 'gastgebühr'],
        content: `### Gastspieler einladen

Mitglieder können jederzeit Gäste zu einem gemeinsamen Match mitbringen, sofern das Gastspiel-Modul im Verein aktiv ist:

1. Wähle im Buchungs-Slider bei der Spielerauswahl die Option **„Gast“**.
2. Trage den Vor- und Nachnamen deines Gastes ein.
3. Das System berechnet automatisch die clubübliche Gastspielgebühr (entweder pauschal pro Platzstunde oder pro Gast).
4. Die Abrechnung erfolgt über das Mitgliedskonto des buchenden Spielers gemäß der Vereinssatzung.`
      },
      {
        id: 'spielpartner-boerse',
        title: 'Die Spielpartner-Börse',
        summary: 'Neue Spielpartner im Club kennenlernen und Verabredungen treffen.',
        keywords: ['börse', 'spielpartner', 'partnerbörse', 'kontakt', 'spielstärke', 'treffen'],
        content: `### Finde passende Spielpartner im Club

Du suchst spontan jemanden für ein Match?
- Gehe in der Navigation auf **Partnerbörse** (oder in der Hobbyliga auf Spielpartner).
- Hier siehst du Mitglieder, die aktiv nach Spielpartnern suchen, inklusive Spielstärke, bevorzugter Spielzeit und Kontaktdaten.
- Du kannst dich mit einem Klick selbst in die Börse eintragen und angeben, an welchen Wochentagen du gerne spielen möchtest.`
      },
      {
        id: 'hobbyliga-matches',
        title: 'Hobbyliga-Spiele buchen & erfassen',
        summary: 'Spiele für die vereinsinterne Hobbyliga reservieren und austragen.',
        keywords: ['hobbyliga', 'hobby', 'liga', 'forderung', 'punkte', 'reiter'],
        content: `### Hobbyliga im Buchungssystem

Wenn du an der Hobbyliga teilnimmst:
- Im Buchungs-Slider erscheint ein eigener Reiter **„Hobbyliga-Spiel“**.
- Wähle deinen Hobbyliga-Gegner direkt aus der Ligaliste aus.
- Nach dem Spiel tragt ihr das Ergebnis direkt im Hobbyliga-Bereich ein. Das System berechnet die Punkte nach offiziellem Schlüssel und aktualisiert die Tabelle.`
      },
      {
        id: 'veranstaltungen-teilnahme',
        title: 'Veranstaltungen & Club-Turniere ansehen & anmelden',
        summary: 'Turniere, Schleifchenturniere und Club-Feste mit einem Klick beitreten.',
        keywords: ['veranstaltung', 'event', 'turnier', 'anmelden', 'austragen', 'schleifchenturnier'],
        content: `### Club-Veranstaltungen im Überblick

- **Kopfzeile & Übersicht:** Der Bereich **Veranstaltungen** bietet eine einheitliche Kopfzeile mit Party-Icon und Untertitel („Anmeldung zu Turnieren und anderen Events“) analog zur Rangliste. Das Hilfebanner mit Bedienungshinweisen ist direkt über der Kopfzeile platziert.
- **Teilnahme anmelden:** Klicke bei einem anstehenden Event auf den Button **„Anmelden“**, um deinen Namen auf die Teilnehmerliste zu setzen.
- **Wieder austragen:** Falls du verhindert bist, klicke erneut auf **„Abmelden“**, um deinen Platz für andere Mitglieder freizugeben.
- **Kommentare & Wünsche:** Bei vielen Events steht dir ein Notizfeld zur Verfügung (z. B. für Spielstärken oder Speisewünsche).`
      }
    ]
  },
  {
    id: 'profil-passwoerter',
    title: 'Profil & Passwörter',
    iconName: 'UserCog',
    description: 'Persönliche Stammdaten, Profilbilder, Passwörter, Benachrichtigungen und Datenschutz.',
    articles: [
      {
        id: 'stammdaten-bearbeiten',
        title: 'Wie ändere ich meine persönlichen Daten?',
        summary: 'Vorname, Nachname, E-Mail, Telefonnummer und Geburtstag aktuell halten.',
        keywords: ['profil', 'daten', 'telefon', 'email', 'adresse', 'ändern', 'speichern'],
        content: `### Profil bearbeiten

1. Klicke in der oberen Menüleiste auf dein **Profilbild / Avatar** oder auf das Zahnrad-Symbol.
2. Im Fenster **„Mein Profil“** kannst du deine Kontaktdaten (Telefonnummer, E-Mail-Adresse) sowie Geburtsdatum und Geschlecht aktualisieren.
3. Klicke unten auf **„Änderungen speichern“**.`
      },
      {
        id: 'passwort-aendern',
        title: 'Passwort ändern & Sicherheit',
        summary: 'So vergibst du ein sicheres neues Kennwort für deinen Vereins-Login.',
        keywords: ['passwort', 'kennwort', 'sicherheit', 'ändern', 'vergessen', 'neu'],
        content: `### Sicheres Passwort vergeben

- Öffne dein **Profil** und scrolle zum Bereich **Passwort ändern**.
- Gib dein neues Wunschpasswort ein und bestätige es.
- **Sicherheitsanforderung:** Das Passwort muss aus mindestens **8 Zeichen** bestehen.
- Nach dem Speichern ist dein neues Kennwort ab sofort für alle zukünftigen Anmeldungen gültig.`
      },
      {
        id: 'avatar-profilbild',
        title: 'Profilbild & Avatar anpassen',
        summary: 'Lade ein persönliches Foto hoch oder wähle schicke Initialen-Farben.',
        keywords: ['avatar', 'bild', 'foto', 'profilbild', 'hochladen', 'initialen'],
        content: `### Dein Foto im System

- Klicke im Profil auf das Kamera-Symbol deines Avatars.
- Du kannst entweder ein eigenes **Foto von deinem Smartphone oder Computer hochladen** (mit praktischem Bildausschnitt-Werkzeug zum Zuschneiden) oder ein **Initialen-Icon** in deiner Lieblingsfarbe wählen.
- Dein Profilbild wird im Kalender, in der Rangliste und bei Meisterschaften für deine Clubkollegen sichtbar.`
      },
      {
        id: 'privatsphaere-kontaktdaten',
        title: 'Privatsphäre & Sichtbarkeit von Kontaktdaten',
        summary: 'Entscheide selbst, wer deine E-Mail oder Telefonnummer sehen darf.',
        keywords: ['privatsphäre', 'datenschutz', 'telefonnummer', 'sichtbarkeit', 'verbergen'],
        content: `### Datenschutz-Einstellungen

In deinem Profil unter **„Privatsphäre & App-Anzeige“** findest du zwei wichtige Schalter:
- **E-Mail und Telefonnummer für andere Spieler anzeigen:** Wenn aktiviert, können andere Clubmitglieder in der Partnerbörse oder Rangliste deine Telefonnummer oder E-Mail sehen, um Verabredungen zu erleichtern. Ist der Haken deaktiviert, bleiben deine Daten vertraulich.
- **Assistent "Ace" aktivieren:** Schaltet das freundliche Maskottchen für schnelle Regelfragen ein oder aus.`
      },
      {
        id: 'onboarding-begruessungsfenster',
        title: 'Das Begrüßungsfenster (Onboarding)',
        summary: 'Was bedeutet die Meldung „Onboarding ausstehend“ zu Saisonbeginn?',
        keywords: ['onboarding', 'begrüßung', 'saisonstart', 'stammdaten', 'bestätigen', 'ace', 'sprechblase'],
        content: `### Saisonales Mitglieder-Onboarding

Zu Beginn einer neuen Saison oder nach Aktualisierung von Vereinsregeln bittet dich der Club beim Login um eine kurze Bestätigung deiner Kontaktdaten:
- Überprüfe kurz, ob Handynummer und E-Mail noch aktuell sind.
- Klicke auf **„Bestätigen“**, um das Fenster dauerhaft zu schließen.
- Falls du gerade in Eile bist, kannst du auf **„Später anzeigen“** klicken; das Fenster erscheint dann beim nächsten Login erneut.
- **ACE Begrüßungs-Sprechblase:** Sobald du das Onboarding zum ersten Mal erfolgreich abgeschlossen hast, begrüßt dich unser Club-Assistent **ACE** mit einer kleinen Sprechblase am unteren Bildschirmrand. Du kannst direkt darauf tippen, um Fragen zu stellen, oder sie mit dem Schließen-Symbol sofort ausblenden (sie schließt sich nach 8 Sekunden auch automatisch).`
      },
      {
        id: 'ace-tennis-assistent',
        title: 'Der Club-Assistent „ACE“ & Begrüßungshinweis',
        summary: 'Dein persönlicher KI-Assistent für Tennisregeln, Buchungshilfen und Meisterschaftsfristen.',
        keywords: ['ace', 'assistent', 'ki', 'tennisball', 'maskottchen', 'begrüßung', 'sprechblase', 'hilfe', 'regeln'],
        content: `### Tennis-Assistent „ACE“

Unten rechts findest du unseren interaktiven Club-Assistenten **ACE** (das Tennisball-Maskottchen mit Stirnband):
- **Automatische Begrüßung:** Wenn du zum ersten Mal das Mitglieder-Onboarding abschließt, stellt sich ACE mit einer dezenten Sprechblase vor („Hi, ich bin ACE! 👋“). Die Sprechblase blendet sich nach 8 Sekunden automatisch aus oder kann mit dem Kreuz geschlossen werden.
- **Direkte Antworten:** Klicke einfach auf ACE oder die Sprechblase, um Regelfragen zu stellen (z. B. zu Tie-Break, Netzberührung, Linienbällen) oder Fragen zu Buchungsregeln und Meisterschaften beantwortet zu bekommen.
- **Deaktivieren:** Falls du ACE nicht benötigst, kannst du ihn jederzeit in deinem Profil unter *Privatsphäre & App-Anzeige* mit dem Schalter *„Assistent "Ace" aktivieren“* oder direkt im Menü des Assistenten dauerhaft ausschalten.`
      }
    ]
  },
  {
    id: 'meisterschaft-ergebnisse',
    title: 'Meisterschaft & Ergebnisse eintragen',
    iconName: 'Trophy',
    description: 'Austragung der Clubmeisterschaft, Spielfristen, K.-o.-Baum und Ergebniseingabe.',
    articles: [
      {
        id: 'meisterschaft-uebersicht',
        title: 'Wie funktioniert die Vereinsmeisterschaft?',
        summary: 'Modus, Gruppenphase, K.-o.-Runden und der große Finaltag.',
        keywords: ['meisterschaft', 'turnier', 'modus', 'k.o.', 'gruppenphase', 'finaltag'],
        content: `### Die Vereinsmeisterschaft im Überblick

Die Vereinsmeisterschaft wird direkt über die Web-App organisiert:
- **Zugang:** Klicke in der Menüleiste auf das Pokal-Symbol **„Meisterschaft“** (auf dem Smartphone unter *„Weiteres“*).
- **Phasen-Navigation:** Über die nummerierten Bento-Karten oben wechselst du gezielt zwischen den Phasen:
  1. **Gruppenphase:** Tabellenstände und Gruppenpartien.
  2. **Halbfinale:** Die qualifizierten Halbfinal-Partien im direkten Duell.
  3. **Endrunde / Finaltag:** Großes Finale und Platzierungsspiele (z. B. Spiel um Platz 3).
- **Fokussierte Ansicht:** Die Ansicht filtert streng nach dem ausgewählten Phasen-Tab, sodass immer nur die aktuell relevanten Matches ohne visuellen Ballast angezeigt werden. Der Wechsel zwischen den Phasen (sowie zwischen den Ranglisten-Kategorien) erfolgt über eine sanfte, extrem schnelle Verblassen-Animation (150 ms) für ein flüssiges Nutzungserlebnis ohne störende Wartezeiten.
- **Phasenspezifische Begegnungen:** Unterhalb der Tabelle bzw. der Tabs findest du direkt die Partien unter der Überschrift **„Begegnungen [Name der Phase]“** (z. B. *Begegnungen Gruppenphase*, *Begegnungen Halbfinale*, *Begegnungen Endrunde / Finaltag*). Ein Klick auf eine Zeile in der Tabelle filtert die Begegnungen gezielt auf die Partien des ausgewählten Spielers.`
      },
      {
        id: 'mein-status-meisterschaften',
        title: 'Mein Status & Fristen einsehen',
        summary: 'Dein persönliches Cockpit für anstehende Meisterschaftsspiele.',
        keywords: ['status', 'gegner', 'frist', 'deadline', 'termin', 'nächstes spiel'],
        content: `### Dein persönlicher Meisterschafts-Status

Sobald du für eine Meisterschaft eingeteilt bist, siehst du ganz oben deine persönliche Infokarte:
- Wer ist dein **nächster Gegner**?
- **Frist (Deadline):** Bis zu welchem Datum muss die Partie gespielt sein?
- Über den Button **„Freies Spiel reservieren“** gelangst du direkt in den Buchungsplan, um einen Platz für euer Match zu sichern.`
      },
      {
        id: 'ergebnis-eintragen',
        title: 'Wie trage ich ein Meisterschaftsergebnis ein?',
        summary: 'Eingabe von Sätzen, Match-Tiebreak und sofortige Wertung.',
        keywords: ['ergebnis', 'eintragen', 'satz', 'tiebreak', 'champions-tiebreak', 'games'],
        content: `### Spielergebnis erfassen

Nachdem ihr euer Match beendet habt:
1. Öffne die Meisterschaftsseite und klicke bei deiner Partie auf **„Ergebnis eintragen“** (oder klicke einfach direkt auf die Bento-Spielkarte). Der grüne Hover-Rahmen und der Klick-Cursor werden nur angezeigt, wenn du zur Ergebniseingabe für diese Partie berechtigt bist.
2. Trage die Games für Satz 1 und Satz 2 ein (z. B. 6:4, 3:6).
3. Bei Satzgleichstand (1:1 Sätze) wird der 3. Satz als **Match-Tiebreak bis 10 Punkte** ausgetragen und eingetragen (z. B. 10:7).
4. Klicke auf **„Ergebnis speichern“**.
5. Die Gruppentabelle bzw. der K.-o.-Baum wird sofort und automatisch in Echtzeit aktualisiert!`
      },
      {
        id: 'tabellenwertung-kriterien',
        title: 'Tabellenwertung & Tie-Break-Kriterien',
        summary: 'Wer kommt weiter bei Punktgleichheit in der Gruppe?',
        keywords: ['tabelle', 'punktgleich', 'kriterien', 'direkter vergleich', 'satzdifferenz', 'spalten'],
        content: `### Tabellenspalten & Kriterien bei Punktgleichheit

Die Gruppentabelle stellt alle Kennzahlen kompakt dar:
- **#:** Tabellenplatz (Top-Plätze für K.-o.-Runde sind grün hervorgehoben).
- **Spieler / Team:** Name des Teilnehmers.
- **SP (Gespielte Partien):** Anzahl ausgetragener Matches.
- **S (Siege) & N (Niederlagen):** Gewonnene und verlorene Partien.
- **SÄTZE:** Satzverhältnis mit Satzdifferenz in Klammern, z. B. \`4:2 (+2)\`.
- **SPIELE:** Spieleverhältnis mit Spieldifferenz in Klammern, z. B. \`36:24 (+12)\`.
- **PKT (Punkte):** Gesamtzahl erreichter Punkte.

Stehen nach Abschluss der Gruppenphase zwei oder mehr Spieler punktgleich, entscheidet automatisch die offizielle DTB-Kaskade:
1. **Anzahl der Siege**
2. **Direkter Vergleich** (bei zwei punktgleichen Spielern)
3. **Satzdifferenz** (gewonnene minus verlorene Sätze)
4. **Spieldifferenz** (gewonnene minus verlorene Spiele)
5. **Erzielte Spiele gesamt**`
      }
    ]
  },
  {
    id: 'preise-guthaben',
    title: 'Preise & Guthaben',
    iconName: 'CreditCard',
    description: 'Gastspielbeiträge, Ballmaschine, Arbeitsdienst und Abrechnungsmodalitäten.',
    articles: [
      {
        id: 'gastspielpreise',
        title: 'Wie werden Gastspiele abgerechnet?',
        summary: 'Tarifmodelle und Zahlungsweise für externe Tennispartner.',
        keywords: ['preise', 'kosten', 'gastgebühr', 'abrechnung', 'tarife', 'überweisung'],
        content: `### Gastspielgebühren im Verein

- Je nach Vereinssatzung wird die Gastgebühr entweder **pauschal pro Platzstunde** (z. B. 10 €/Std.) oder **personenbezogen pro Gast** (z. B. 5 € pro Gast) berechnet.
- Die genaue Gebühr wird dir bereits vor dem Klick auf „Jetzt buchen“ transparent im Buchungsfenster angezeigt.
- Die Abrechnung erfolgt am Saisonende oder quartalsweise über den Kassenwart per Lastschrifteinzug oder Rechnungsstellung.`
      },
      {
        id: 'ballmaschine',
        title: 'Ballmaschine buchen & nutzen',
        summary: 'Ausleihe und Zuzahlung für Vereine mit elektronischer Ballwurfmaschine.',
        keywords: ['ballmaschine', 'bälle', 'training', 'zubuchen', 'gebühr'],
        content: `### Ballmaschinen-Verleih

Verfügt dein Verein über eine Ballmaschine:
- Kannst du im Buchungs-Slider den Haken **„Ballmaschine zubuchen“** setzen.
- Die Ballmaschine steht auf den dafür freigegebenen Plätzen bereit.
- Bitte beachte die clubinternen Einweisungsvorschriften und gehe pfleglich mit Bällen und Fernbedienung um.`
      },
      {
        id: 'arbeitseinsaetze-helferstunden',
        title: 'Arbeitseinsätze & Helferstunden',
        summary: 'So behältst du deine geleisteten Stunden und Pflichtstunden im Blick.',
        keywords: ['arbeitseinsatz', 'helferstunden', 'stunden', 'arbeitsdienst', 'ersatzgebühr'],
        content: `### Arbeitsdienst-Erfassung

Viele Tennisvereine verlangen von aktiven Erwachsenen eine bestimmte Anzahl an Helferstunden pro Jahr (z. B. Platzinstandsetzung im Frühjahr oder Pflege der Außenanlagen):
- Auf deinem **Dashboard** siehst du im Modul „Meine Arbeitsstunden“ deinen aktuellen Fortschrittsbalken (z. B. *7 von 10 Stunden geleistet*).
- Für nicht geleistete Stunden wird am Saisonende eine satzungsgemäße Ersatzgebühr fällig.
- Nach Ableistung eines Arbeitseinsatzes bestätigt der Platzwart oder Vorstand die Stunden, woraufhin dein Fortschrittsbalken ansteigt.`
      }
    ]
  }
];

/**
 * Returns a clean, consolidated plain-text representation of all user help categories and articles.
 * This can be directly fed into LLM / AI Chatbots (like Ace) as their primary system context.
 */
export function getUserHelpPlainText(): string {
  let output = '=== OFFIZIELLES BENUTZER-HANDBUCH & HILFE-SYSTEM ===\n\n';

  USER_HELP_CATEGORIES.forEach((cat, cIdx) => {
    output += `----------------------------------------------------\n`;
    output += `KATEGORIE ${cIdx + 1}: ${cat.title.toUpperCase()}\n`;
    output += `Beschreibung: ${cat.description}\n`;
    output += `----------------------------------------------------\n\n`;

    cat.articles.forEach((art) => {
      output += `[THEMA: ${art.title}]\n`;
      output += `Kurzfassung: ${art.summary}\n`;
      output += `Stichworte: ${art.keywords.join(', ')}\n\n`;
      output += `${art.content}\n\n`;
    });
  });

  return output;
}

export const USER_HELP_PLAIN_TEXT = getUserHelpPlainText();
