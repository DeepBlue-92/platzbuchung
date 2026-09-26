### Multi-Tenant System
Die Anzeige des Vereinsnamens wird erst dann geladen, wenn der echte Name aus der Datenbank geladen wurde, um ein Flackern des Standardwerts (früher SV Neuhausen) während der kurzen Ladezeit zu verhindern. Somit wird sichergestellt, dass Mitglieder anderer Vereine nicht den falschen Standard-Vereinsnamen sehen.

### URL-Zugang
Die Mandantenstruktur erkennt den Verein inzwischen an der entsprechenden URL oder über die Subdomain.

### Veranstaltungen & Events (Turniere)
Die Erstellung und Verwaltung von Veranstaltungen und Turnieren ist direkt auf der Veranstaltungs-Seite (nicht mehr in den System-Einstellungen) möglich.

- **Event erstellen/bearbeiten:** Administratoren können direkt auf der Veranstaltungs-Seite neue Events anlegen oder bearbeiten. Es öffnet sich hierfür ein praktischer Slider, wie man ihn von der Platzreservierung kennt.
  - *Archivierung nach Ablauf der Veranstaltung:* Hierüber lässt sich präzise festlegen, ob abgelaufene Events archiviert und ausgeblendet werden sollen.
  - *Kommentarfeld bei Anmeldung anzeigen?:* Ermöglicht es Mitgliedern, bei der Anmeldung zu einem Event optional einen Kommentar (z. B. für Essenswünsche oder Spielstärken) zu hinterlassen.
- **Audit-Log (Verlauf):** Neben dem Bearbeiten-Knopf gibt es einen "Audit"-Knopf. Hierüber können Administratoren genau nachvollziehen, wann sich welches Mitglied für das Event an- oder abgemeldet hat.
- **Papierkorb:** Gelöschte Events werden in einen Papierkorb verschoben und tauchen unten auf der Veranstaltungs-Seite auf. Dort können diese bei Bedarf wiederhergestellt werden. Der Papierkorb wird automatisch aufgeräumt – Events, die länger als 30 Tage gelöscht sind, werden endgültig entfernt.

### Buchungs- & Reservierungs-System
- **Standardansicht nach Gerät (Mobil vs. Desktop):** Auf mobilen Endgeräten (Smartphones und Bildschirmen unter 1024px) öffnet sich die Reservierungsübersicht standardmäßig als übersichtlicher **Tagesplan** mit direkter Stundeneinteilung und Platzspalten. Auf Desktop-Computern bleibt die Standardansicht wie gewohnt der **Wochenplan** mit der gesamten Wochenübersicht. Über die Navigationsleiste kann der Nutzer jederzeit frei zwischen Tages- und Wochenansicht wechseln.
- **Klarname statt Benutzername:** Im gesamten Buchungs- und Reservierungssystem (inklusive Kalender-Raster, Detail-Overlays und der Buchungslisten im Administrationsbereich) wird für die Darstellung der Spieler und Buchenden primär der echte Name in der gut lesbaren Formatierung "Nachname, Vorname" verwendet, sofern diese Angaben im Benutzerprofil ausgefüllt sind. Der interne Benutzername dient nur noch als automatisches Fallback, falls kein echter Name existiert.

### Schnittstellen (Öffentliche Feeds)
- **Zugriffsschutz bei Inaktivität:** Wird ein öffentlicher Buchungs-Feed deaktiviert, so verweigert der Server den Abruf mit einem sauberen Fehlercode (Status 403 Forbidden - Verboten), statt unautorisierte Aufrufer fälschlicherweise zur Login-Seite des Systems weiterzuleiten. Ist der Feed aktiv, bleibt er ohne Anmeldung erreichbar.

### Öffentlicher Wochenplan & Schnellbuchungs-Trichter
Für Partnervereine (wie z. B. die **DJK Furth**) steht eine optimierte, öffentlich zugängliche Ansicht zur Verfügung.
- **Öffentlicher Zugang:** Über die spezielle Internetadresse [/public/wochenplan](/public/wochenplan) können auch nicht angemeldete Besucher den aktuellen Belegungsplan einsehen. Auf dieser Seite ist die normale Hauptnavigation komplett ausgeblendet, um eine übersichtliche Ansicht zu gewährleisten.
- **Vollständige Klarnamen:** In allen bestehenden Buchungen werden die vollen Namen der spielenden Mitglieder (Format: "Nachname, Vorname") ausgeschrieben angezeigt.
- **Schnellbuchung (Slider):** Klickt ein nicht angemeldetes Mitglied auf einen freien Zeitslot, öffnet sich ein seitlicher Schiebe-Slider mit einem kompakten Anmeldeformular. Nach der schnellen Passworteingabe wird die Anmeldung im Hintergrund durchgeführt. Der Slider wechselt sofort und ohne Neuladen der Seite direkt zum eigentlichen Buchungsformular für den ausgewählten Platz, um die Reservierung abzuschließen.

### Hobbyliga-Spiele
- **Buchung im Slider:** Neben der regulären "Platzbuchung" gibt es im Buchungs-Slider (mobil und am Computer) nun einen separaten Bereich (Reiter/Tab) namens "Hobbyliga-Spiel".
- **Sichtbarkeit:** Der Reiter "Hobbyliga-Spiel" wird nur angezeigt, wenn der Verein die Hobbyliga in den Einstellungen aktiviert hat UND der Benutzer in seinem Profil der Hobbyliga beigetreten ist.
- **Suchfunktion:** Findet man im normalen Tab "Platzbuchung" keinen Mitspieler (weil dieser nur Hobbyliga-Mitglied ist), wird ein Hinweis eingeblendet, um direkt zur Hobbyliga-Buchung zu wechseln.
- **Rangliste:** Die reguläre Vereins-Rangliste ist streng von der Hobbyliga getrennt. Hobbyliga-Filter und der Punkteverlauf erscheinen ausschließlich auf der dedizierten Hobbyliga-Seite.

### Mitglieder-Onboarding (Begrüßungsfenster)
Administratoren können im Menübereich **Einstellungen** unter dem Reiter **Mitglieder-Onboarding** (gestaltet im einheitlichen Design und voller Seitenbreite wie die Mitgliederverwaltung) festlegen, was Mitglieder beim ersten oder nächsten Einloggen sehen.
- **Volle Seitenbreite & Übersicht:** Die Verwaltungsseite nutzt die gesamte Breite des Bildschirms mit dem gewohnten Header-Karten-Design, Status-Pillen und direkter Vorschau-Möglichkeit.
- **Hauptschalter:** Bestimmt, ob das Begrüßungsfenster für Mitglieder beim Login überhaupt aufgerufen wird.
- **Felder anpassen:** Für jedes persönliche Profilfeld (wie Vorname, Nachname, Telefon, Geschlecht, Geburtsdatum, Passwort) kann der Verein einstellen, ob das Feld frei bearbeitbar, nur lesbar oder komplett ausgeblendet sein soll.
- **Schreibgeschützte Felder:** Wenn Stammdaten (z. B. Geburtsdatum oder Geschlecht zur Liga-Einteilung) im Admin-Menü auf schreibgeschützt gesetzt sind, werden die Eingabefelder mit einem sanft abgedunkelten Hintergrund (`bg-slate-100`) und gesperrtem Mauszeiger dargestellt, während das Kachellayout ohne überflüssige Badges oder Hinweistexte maximal sauber und aufgeräumt bleibt.
- **Klare Formular-Hierarchie & volle Breite:** Die Bereiche sind logisch nach Relevanz von oben nach unten geordnet:
  1. *Persönlicher Name* (Vorname und Nachname)
  2. *Demographie* (Geburtsdatum und Geschlecht in voller Breite ohne Abschneiden von Datumswerten)
  3. *Passwort festlegen (Optional)* (sicherheitsrelevante Einstellungen mit 8 Zeichen Mindestanforderung)
  4. *Profilbild & Avatar* (optische Personalisierung im aufgeräumten Design vor dem Bestätigen)
- **Hintergrund-Scrollsperre:** Bei geöffnetem Onboarding-Fenster wird das Scrollen des Seitenhintergrunds im Browser gesperrt, sodass das Scrollrad ausschließlich innerhalb der Onboarding-Karte wirkt.
- **Modernes Split-Design:** Auf Computern und Bildschirmen ab Desktop-Größe erscheint das Begrüßungsfenster in einem luftigen zweigeteilten Layout. Links begrüßt direkt über der Hauptüberschrift eine lebendige Tennis-Lottie-Animation im Hochkontrast-Look das Mitglied. Rechts befinden sich die persönlichen Datenfelder in kompakten Kacheln, die auf Standard-Desktop-Displays ohne internen Scrollbalken vollständig überblickbar sind.
- **Smartphone-Optimierung:** Auf mobilen Geräten unterhalb des Desktop-Breakpoints wird die Animation automatisch ausgeblendet und die Spalten werden vertikal gestapelt, damit der Begrüßungstext und alle Formularfelder übersichtlich und ohne Gedränge bedient werden können.
- **Passwort-Sicherheit:** Wird im Onboarding die Vergabe eines neuen Passworts genutzt, gilt eine barrierefreie Mindestanforderung von 8 Zeichen (mit passendem Hilfetext und Eingabeüberprüfung).
- **Klares Avatar-Design:** Der Bereich für das persönliche Profilbild zeigt eine kompakte Kachel ohne doppelte Überschriftenzeilen.
- **Bestätigen oder Später anzeigen:** Am unteren Rand des Formulars befindet sich links neben dem Button *„Bestätigen“* ein dezenter Textlink *„Später anzeigen“*. Klickt das Mitglied auf *„Später anzeigen“*, schließt sich das Fenster für die laufende Sitzung, ohne die Stammdaten oder die Kennzeichnung „Onboarding ausstehend“ in der Datenbank zu verändern. Beim nächsten Anmelden wird das Begrüßungsfenster automatisch erneut angezeigt. Erst mit Klick auf *„Bestätigen“* werden die aktualisierten Daten in der Datenbank gespeichert und das Onboarding gilt dauerhaft als abgeschlossen.
- **Stapelverarbeitung: Onboarding-Status (Selektive Steuerung & Schnellsuche):** Im unteren Bereich der Einstellungen steht eine flexible Verwaltungskarte für alle Mitglieder bereit:
  - *Schnellsuche:* Durchsuche die Mitgliederliste in Echtzeit nach Vorname, Nachname, Benutzername oder E-Mail-Adresse.
  - *Schnellfilter (Pills):* Wechsle mit einem Klick zwischen *„Alle“*, *„Ausstehend“* (Onboarding offen) und *„Erledigt“* (bereits bestätigt).
  - *Einzelauswahl & Mehrfachauswahl (Bulk):* Über die Checkbox im Tabellenkopf („Mitglied“) lassen sich alle aktuell gefilterten oder sämtliche Vereinsmitglieder mit einem Klick markieren bzw. abwählen. Zudem kann jedes Mitglied über die linke Checkbox einzeln ausgewählt werden.
  - *Aktionsleiste für Markierte:* Sobald Mitglieder markiert sind, erscheint automatisch die Aktionsleiste mit den Schaltflächen *„Onboarding aktivieren“* (setzt den Status auf ausstehend) und *„Als erledigt markieren“*. So lässt sich das Onboarding sowohl für gezielte Gruppen als auch für alle Mitglieder einheitlich steuern.
  - *Direkt-Umschalter:* Jedes Mitglied besitzt in der Liste ganz rechts einen Schnell-Knopf (*„Aktivieren“* bzw. *„Erledigt“*), um den Status sofort ohne Umwege umzuschalten.
- **Erfolgs- und Fehlermeldungen:** Nach dem Speichern oder Ausführen einer Stapelaktion zeigt ein klarer Infobalken direkt an, ob die Aktion erfolgreich war oder ob ein Fehler aufgetreten ist.

### Benachrichtigungs-System & Massenverwaltung (Bulk Actions)
Administratoren können im Menübereich **Einstellungen** unter dem Reiter **Benachrichtigungen** (Glocken-Symbol 🔔) alle Benachrichtigungs-Abonnements der Mitglieder verwalten, Massenaktionen durchführen, Onboarding-Standards festlegen und Vorlagen bearbeiten:

- **Massenbearbeitung (Bulk Actions & Filter):**
  - *Such- & Filtersystem:* Suche Mitglieder in Echtzeit nach Vor-/Nachname oder E-Mail-Adresse. Filtere nach Ligen (z. B. *„Nur Hobbyliga aktiv“* oder *„Keine Hobbyliga“*) sowie gezielt nach einzelnen Benachrichtigungs-Events.
  - *Mehrfachauswahl & Tabellen-Checkbox:* Über die Master-Checkbox im Tabellenkopf lassen sich alle aktuell gefilterten Spieler mit einem Klick auswählen (z. B. *„Alle 142 Spieler markieren“*).
  - *Kontextuelle Bulk-Action-Bar:* Sobald mindestens ein Spieler markiert ist, erscheint die Aktionsleiste. Admins wählen ein Event (z. B. `HOBBYLIGA_NEW_POST` oder `MATCH_RESULT_SUBMITTED`) und können dieses für alle markierten Spieler mit einem Klick gebündelt *aktivieren* oder *deaktivieren*.
  - *Direkt-Umschalter:* In der Mitgliederliste kann jedes Event für ein einzelnes Mitglied sofort per Klick auf die Status-Schaltfläche ein- oder ausgeschaltet werden.

- **Onboarding-Defaults (Standardvorgaben für Neumitglieder):**
  - Im oberen Bereich der Seite können Administratoren festlegen, welche Benachrichtigungen neu registrierte Mitglieder standardmäßig beim Beitritt oder im Onboarding aktiviert haben.
  - Mit Klick auf *„Defaults speichern“* werden diese Vorgaben dauerhaft im Vereinsprofil hinterlegt.

- **Spezifische Event-Logik & Empfänger-Filterung:**
  - *`HOBBYLIGA_NEW_POST` (Hobbyliga: Neuer Beitrag):* Broadcast-Benachrichtigung an alle aktiven Teilnehmer der Hobbyliga, sobald ein neuer Pinnwand-Beitrag erstellt wird. Der Verfasser des Beitrags wird automatisch und strikt aus dem Empfängerkreis ausgeschlossen.
  - *`MATCH_RESULT_SUBMITTED` (Match-Ergebnis eingetragen):* Geht nach der Ergebniseingabe eines Matches strikt und ausschließlich an den gegnerischen Spieler. Der eintragende Spieler selbst erhält niemals eine redundante E-Mail.
  - *`RESERVATION_CONFIRMED` / `RESERVATION_CANCELLED`:* Bestätigungs- und Stornierungs-E-Mails bei Buchungsvorgängen.

- **Event-Testbench & Simulation:**
  - Unter dem Reiter *„Event-Testbench (Broadcast & Match)“* können Administratoren Test-Broadcasts und Ergebnis-Nachrichten simulieren.
  - Das System zeigt transparent an, wie viele E-Mails generiert wurden, wer als Verfasser ignoriert wurde und wie viele Spieler aufgrund von Opt-out-Einstellungen übersprungen wurden.

- **Enterprise-E-Mail-Vorlagen (Workday-Modell):**
  - Unter dem Reiter *„E-Mail-Vorlagen & Editor“* können E-Mail-Texte mit klickbaren Platzhaltern (`{{user_name}}`, `{{court_name}}`, `{{date}}`, etc.) angepasst werden.
  - Beim Versand wird der Text automatisch in ein festes, responsives und tabellenbasiertes HTML-Layout mit Header-Banner und Footer eingebettet. Live-Vorschau in Echtzeit für Desktop und Smartphone sowie Testmail-Versand via Resend.

### Vereinsmeisterschaft (Modul)
Das offizielle Vereinsmeisterschafts-Modul ermöglicht die Austragung von Sommer- und Wintermeisterschaften mit automatischer Tabellen- und Turnierbaumberechnung.

- **Zugang für alle Mitglieder:**
  - *Am Computer (Desktop):* Direkt in der oberen Menüleiste über den Reiter **Meisterschaft** (gekennzeichnet durch das Pokal-Symbol 🏆 / `Trophy`). Zur klaren Unterscheidung nutzt die Hobby-Liga das Wappen-Symbol 🛡️ / `Shield`.
  - *Am Smartphone (Mobil):* Über das Menü **Weiteres / Mehr** (Drei-Punkte-Symbol) aufrufbar.
- **Persönliche Status-Kachel ("Mein Status"):**
  - Sobald ein Mitglied eingeloggt ist und an einer laufenden Meisterschaft teilnimmt, sieht es ganz oben seine persönliche Spielübersicht:
    - Nächster ausstehender Gegner inklusive Frist (Deadline) für die aktuelle Runde.
    - Schnelleingabe-Knopf *„Ergebnis eintragen“*, um das Match ohne Suchen direkt zu erfassen.
    - Direkte Verknüpfung *„Freies Spiel reservieren“*, um zu freien Buchungszeiten einen Platz zu sichern.
- **Unabhängige Platzbuchung:**
  - Spieler reservieren für Meisterschaftsspiele ganz normal einen freien Platz im Buchungssystem (freies Spiel). Es ist keine starre Vorbefüllung nötig. Der Eintrag des Spielergebnisses erfolgt völlig unabhängig von der Platzbuchung direkt in der Meisterschaftsansicht.
- **Gruppenphase & Live-Tabellen:**
  - Zeigt alle Gruppen der Vorrunde (z. B. Gruppe A & B mit je 4 Spielern).
  - *Faire Tie-Break-Rangfolge:* Bei Punktgleichheit entscheidet automatisch die offizielle Kaskade:
    1. Anzahl Siege
    2. Direkter Vergleich (bei exakt 2 punktgleichen Spielern)
    3. Satzdifferenz
    4. Spiel- bzw. Gamedifferenz
    5. Erzielte Games
  - Klickt man auf einen Spieler in der Tabelle, filtert die Begegnungsliste automatisch nach allen Spielen dieser Person.
- **K.-o.-Turnierbaum (Endrunde):**
  - Zeigt Halbfinale und Finale mit grafischen Verbindungslinien.
  - Auf Desktop-Bildschirmen als mehrspaltiger Baum dargestellt; auf Smartphones als umschaltbare Phasen-Reiter, damit nichts abgeschnitten wird.
  - Gewinner ziehen nach Eintragen des Ergebnisses automatisch in die nächste Runde ein.
- **Ergebniseingabe & Walkover (w/o):**
  - Reguläre Eingabe von 2 Gewinnsätzen inklusive Champions-Tiebreak im 3. Satz.
  - *Automatische Verletzungs-/Ausfall-Wertung:* Fällt ein Spieler verletzungsbedingt aus und wird als „Ausgeschieden“ markiert, werden alle noch *offenen* Vorrundenspiele für die jeweiligen Gegner automatisch als 6:0, 6:0 Walkover gewertet. Bereits tatsächlich gespielte Partien bleiben mit ihrem echten Ergebnis bestehen.
- **Turnier-Verwaltung & Vorlagen (Für Administratoren):**
  - *Aktivierung in den Systemeinstellungen:* Unter **Einstellungen** ➔ **Allgemein** im Bereich **Module aktivieren** lässt sich die **Meisterschaft** (platziert direkt nach der Rangliste und vor den Gastspielen) für den Verein global ein- oder ausschalten. Standardmäßig ist die Meisterschaft deaktiviert. Erst nach der Aktivierung wird der Reiter in der oberen Kopfleiste für Mitglieder sichtbar.
  - *Eigenständiger Admin-Reiter:* In der horizontalen Menüleiste der System-Einstellungen steht Administratoren der eigenständige Reiter **Meisterschaft** (Trophäen-Icon 🏆) zur Verfügung.
  - *Zwei getrennte Verwaltungsbereiche:*
    - **Turniere:** Übersicht aller aktiven, archivierten und gelöschten Meisterschaften. Über den Button *„Neue Meisterschaft“* (direkt bei den Statusfiltern) führt ein komfortabler Einrichtungsassistent in drei Schritten (Auswahl der Vorlage, Festlegung von Namen und Fristen sowie Zuweisung der Spieler zu Gruppen und Setzplätzen) durch den Turnierstart.
    - **Turnier-Vorlagen:** Übersicht aller gespeicherten Spielformate.
      - *Vollwertiger In-Page-Editor:* Beim Klick auf *„Neue Vorlage erstellen“* oder *„Vorlage bearbeiten“* öffnet sich ein übersichtliches, ganzseitiges Editor-Formular direkt auf der Admin-Seite. Über den Button *„← Zurück zur Vorlagen-Übersicht“* oben links oder im Fußbereich gelangt man jederzeit ohne Speichern zurück zur Liste.
      - *Standardisiertes Match-Format:* Meisterschaftsspiele folgen stets der offiziellen Regelung (2 Gewinnsätze / Best of 3 mit Match-Tie-Break bis 10 Punkte als 3. Entscheidungssatz). Manuelle Format-Konfigurationen sind daher nicht nötig und wurden zugunsten maximaler Übersichtlichkeit aus dem Formular entfernt.
      - *Grunddaten (Titel und Regelwerk):*
        - **Disziplin:** Schnelle Auswahl über ein sauberes Dropdown (*„Einzel (1 vs. 1)“* oder *„Doppel (2 vs. 2)“*) ohne störende Schaltflächen oder Icons.
        - **Regel bei Punktgleichstand:** Unkomplizierte Auswahl zwischen dem *Direkten Vergleich* und der *Satz- & Spieledifferenz* in einem kompakten Auswahlfeld ohne überflüssige Zusatztexte.
      - *Chronologische Phasen-Pipeline:* Die einzelnen Stufen des Turniers sind von oben nach unten geordnet und mit dezenten Flusslinien samt Pfeil (↓) verknüpft. Über Pfeiltasten (nach oben / unten) kann der Administrator die Reihenfolge flexibel anpassen.
      - *Abschluss-Zusammenfassung des Turniermodus (Bento-Karte):* Am Ende der Pipeline fasst eine eigenständige Bento-Karte die gesamte Kette in klarer Vereinssprache zusammen (z. B. *„1. Gruppenphase: 2 Gruppen à 4 Spieler ➔ 2. K.-o.-Phase: 4 Teilnehmer im K.-o.-Modus ➔ 3. Finaltag: Großes Finale & Spiel um Platz 3“*) inklusive Bestätigungs-Badge (*„✓ Pipeline schlüssig: 4 Aufsteiger füllen das 4er-Feld exakt“*).
      - *Phasen am Pipeline-Ende anhängen:* Über die gestrichelte Aktions-Kachel am Ende der Kette lassen sich weitere Gruppenphasen, K.-o.-Endrunden oder ein *Finaltag / Event* chronologisch anfügen.
      - *Kompakte Datums- und Fristen-Eingabe:*
        - **Reguläre Phasen (Gruppenphase, K.-o.-Runden):** Kompaktes Inline-Feld mit dem Label *„Zu spielen bis“* ohne störenden Erläuterungstext.
        - **Finaltag / Event:** Kompaktes Inline-Feld mit dem Label *„Datum“*.
        - **Keine doppelten Namensfelder & Auto-Synchronisation:** Der editierbare Phasenname direkt im Karten-Header dient als eindeutige Benennung; redundante Zweitfelder wie „Rundenbezeichnung“ entfallen.
      - *Strikte Trennung von K.-o.-Runden:* Jede K.-o.-Karte repräsentiert genau eine konkrete Stufe mit eigener Frist (*Achtelfinale: 16 Spieler / 8 Matches*, *Viertelfinale: 8 Spieler / 4 Matches*, *Halbfinale: 4 Spieler / 2 Matches*, *Finale: 2 Spieler / 1 Match*). Beim Ändern der Stufe synchronisiert sich der Phasentitel oben links automatisch mit der gewählten Rundenbezeichnung (z. B. *„Halbfinale“*), bleibt aber frei anpassbar.
      - *Modulare Platzierungsspiele am Finaltag (Ausspielungs-Tiefe):*
        - Das starre Dropdown früherer Versionen wurde durch eine dynamische Einstellung *„Ausspielung der Plätze bis:“* ersetzt.
        - Die Optionen berechnen sich automatisch anhand der Teilnehmerzahl der Vorrunde in 2er-Schritten (*„Nur Finale (Platz 1 & 2)“*, *„+ Spiel um Platz 3“*, *„+ Spiel um Platz 5“*, *„+ Spiel um Platz 7“* usw.).
        - Eine informative Infobox zeigt unmittelbar an, wie viele Matches angesetzt sind und welche Plätze die Teilnehmer am Event-Tag ausspielen (z. B. *„Insgesamt 4 Matches am Finaltag angesetzt. Alle 8 teilnehmenden Mitglieder bestreiten ihr jeweiliges Platzierungsspiel.“*).
        - Das Feld *„Datum“* mit Kalender-Picker legt das genaue Event-Datum fest.
- **Turnier-Fortschrittsdiagramm ("Turnier-Reise"):**
  - Oben in der Meisterschaftsansicht visualisiert ein interaktiver Stepper den gesamten Turnierablauf von der ersten Gruppenphase bis zum Finale.
  - Jede Phase zeigt ihren aktuellen Bearbeitungsstand (z. B. *„6 / 12 Spiele absolviert“* mit Fortschrittsbalken), den Phasenstatus (*Abgeschlossen*, *Aktiv*, *Bevorstehend*) sowie Fristen oder Event-Termine.
  - Mit einem Klick auf eine Phase im Diagramm springt die Ansicht direkt zum passenden Reiter (z. B. Gruppenphase oder K.-o.-Baum).
  - *Vorlagen-Schutz (Gesperrt bei Verwendung):* Vorlagen, die bereits in aktiven oder archivierten Meisterschaften zum Einsatz kommen, werden automatisch mit einem Schlosssymbol geschützt (`Gesperrt`). So wird verhindert, dass laufende Wettbewerbe nachträglich verfälscht werden. Mit einem Klick auf *„Duplizieren“* lässt sich jedoch sofort eine bearbeitbare Kopie erstellen.
  - *Papierkorb mit 30-Tage-Frist:* Gelöschte Meisterschaften verbleiben 30 Tage lang im Papierkorb und können mit einem Klick samt aller Ergebnisse und Historien wiederhergestellt werden, bevor sie endgültig bereinigt werden.

