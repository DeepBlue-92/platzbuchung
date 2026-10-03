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

### Benachrichtigungs-System & E-Mail-Verwaltung
Administratoren können im Menübereich **Einstellungen** unter dem Reiter **Benachrichtigungen** (Glocken-Symbol 🔔) alle Benachrichtigungs-Vorlagen verwalten, globale Vereinsvorgaben steuern und den E-Mail-Versand über Master-Schalter kontrollieren:

- **Klare Strukturierung in zwei Haupt-Reiter:**
  - **1. E-Mail-Einstellungen (Standardmäßig aktiv):** Aufgeteilt in zwei übersichtliche Bento-Bereiche: die globalen Vereinseinstellungen samt Not-Aus-Schalter und die schlanke Spieler-Massenverwaltung.
  - **2. Nachrichtenvorlagen:** Die Vorlagen-Bibliothek mit strukturierter Übersichtstabelle aller erstellten Designs, 30-Tage-Papierkorb und dem visuellen modularen Block-Editor.

- **Reiter „E-Mail-Einstellungen“ (Zwei klare Bento-Bereiche):**
  - **Bereich 1 (oben): Globale E-Mail-Einstellungen:**
    - *Globaler Not-Aus-Schalter („E-Mail-Versand global pausieren“):* Platziert oben rechts im Kopfbereich. Nach einer Sicherheits-Rückfrage lässt sich der gesamte E-Mail-Versand des Vereins sofort stoppen. Bei aktivem Not-Aus werden sämtliche E-Mail-Vorgänge pausiert und die darunterliegende E-Mail-Matrix wird ausgegraut. Auch für die erneute Reaktivierung des Versands ist aus Sicherheitsgründen eine Bestätigungsabfrage vorgeschaltet.
    - *Schlanke 4-spaltige Matrix:* Übersichtliche Tabelle aller 5 System-Events:
      1. **Buchungsbestätigung**
      2. **Buchungsstornierung**
      3. **Buchungsänderung**
      4. **Neuer Hobbyliga-Beitrag**
      5. **Match-Ergebnis eingetragen**
    - *Spalte 2 („Versand systemweit aktiv“):* Schlichte Checkbox, um einzelne E-Mail-Typen klubweit als Master-Schalter zu steuern.
    - *Spalte 3 („Standard bei Registrierung“):* Schlichte Checkbox, ob neue Mitglieder dieses Event automatisch voreingestellt abonniert haben.
    - *Spalte 4 („Aktive Vorlage“):* Dropdown zur 1:1 Zuweisung des Designs aus der Bibliothek samt Direktlink zum visuellen Editor.
    - *Speichern-Schaltfläche:* Änderungen an der Systemaktivität, den Registrierungsstandards oder der Vorlagenzuweisung werden per Klick auf die Schaltfläche *„Speichern“* dauerhaft gesichert.
  - **Bereich 2 (darunter): Individuelle Spieler-Benachrichtigungen:**
    - *Großes Suchfeld & Schnell-Leeren:* Griffiges Suchfeld zur Echtzeit-Filterung nach Namen oder E-Mail-Adresse inklusive „✕“-Schaltfläche zum schnellen Zurücksetzen.
    - *Auswahlanzeige & Speichern-Button:* Neben dem Suchfeld befindet sich die Zähler-Info („X von Y markiert“) und der Button *„Speichern“*, mit dem vorgenommene Änderungen an den Berechtigungen dauerhaft in die Datenbank übernommen werden.
    - *Spieler-Tabelle (Höhenstabilität & Leerraum):* Eine Zeile pro Mitglied mit Name, E-Mail und 5 separaten Spalten mit schlichten Checkboxen für die 5 E-Mail-Typen. Die Tabelle besitzt eine feste Mindesthöhe: Wird durch eine Suche nur ein Spieler gefunden, bleibt der Tabellenbereich unten sauber und leer, wodurch die Seitenhöhe nicht mehr springt.
    - *Paginierung (30 Spieler pro Seite):* Es werden maximal 30 Spieler pro Seite angezeigt. Überschreitet die Anzahl 30 Mitglieder (z. B. bei größeren Vereinen), erscheint am Fuß der Tabelle eine Paginierungsleiste zum Blättern zwischen den Seiten.
    - *„Alle auswählen“-Checkbox:* Die Checkbox im Tabellenkopf neben „Mitglied“ wählt alle aktuell sichtbaren bzw. gefilterten Spieler mit einem Klick an oder ab.
    - *Direktklick & Master-Abhängigkeit:* Die Checkboxen in den Zeilen lassen sich für jeden Spieler direkt anklicken und umschalten; die Änderungen werden beim Klick auf *„Speichern“* übernommen. Ist ein E-Mail-Typ in den globalen Einstellungen deaktiviert oder der Not-Aus aktiv, wird die entsprechende Checkbox automatisch gesperrt („Global aus“).

- **Vorlagen-Bibliothek (Reiter „Nachrichtenvorlagen“):**
  - *Übersichtstabelle aller Vereins-Vorlagen:* Eine aufgeräumte Tabelle listet alle für den Verein erstellten E-Mail-Designs auf:
    - **Name der Vorlage:** Individuelle Bezeichnung (z. B. *„Standard Buchungsbestätigung 2026“* oder *„Sommer-Turnier Sonderdesign“*).
    - **Event-Typ:** Der fest zugeordnete Anwendungsfall (z. B. Buchungsbestätigung, Stornierung, Pinnwand-Post). Nach der Erstellung bleibt dieser Typ unveränderlich, damit Platzhalter und Daten immer 100 % zueinander passen.
    - **Status:** Grünes Badge *„Aktiv zugewiesen“*, falls diese Vorlage im Reiter *„E-Mail-Einstellungen“* aktuell für den Live-Versand ausgewählt ist; andernfalls *„Bereit“*.
    - **Aktionen:** 
      - *„Bearbeiten“:* Lädt das Design und klappt den visuellen Block-Editor darunter sanft und ohne störendes Springen der Ansicht auf.
      - *„Löschen“ (Papierkorb):* Verschiebt nicht mehr benötigte Vorlagen in den Soft-Delete. *Schutzregel:* Eine Vorlage, die aktuell einem Event aktiv zugewiesen ist, kann nicht gelöscht werden, bevor nicht eine andere Vorlage als aktiv hinterlegt wurde.
  - *„Neue Vorlage anlegen“:* Über den Button oben rechts öffnet sich ein schlankes Fenster zur Eingabe des Namens, Auswahl des Event-Typs und Duplizieren bestehender Bausteine.
  - *30-Tage-Papierkorb (Soft Delete):*
    - Über die Schaltfläche *„Papierkorb anzeigen“* lassen sich gelöschte Vorlagen einsehen, wiederherstellen oder endgültig löschen.
    - Vorlagen, die länger als 30 Tage im Papierkorb liegen, werden automatisch bereinigt.
  - *Strikter Vereinsbezug:* Vorlagen werden für den jeweiligen Verein in der Datenbank gespeichert – alle Administratoren desselben Vereins sehen denselben Stand, ohne dass Daten vereinsübergreifend vermischt werden.
  - *Visueller Block-Editor & Spalten-Layout:*
    - **Betreffzeile im Canvas-Kopf mit direkter Badge-Darstellung:** Direkt über der visuellen E-Mail-Vorschau befindet sich das Feld *„Posteingang Betreffzeile“*. Platzhalter wie `[Platz-Bezeichnung]`, `[Datum]` oder `[Uhrzeit]` werden direkt im Eingabekasten als konsistente Badges mit Rahmen und Kursivschrift dargestellt – exakt so wie im Mail-Template.
    - **Direkte Inline-Bearbeitung per Klick:** Ein Klick in das Feld öffnet die Texteingabe zum Tippen. Bei Klick außerhalb oder Drücken der Eingabetaste werden die Badges wieder direkt gerendert.
    - **Variablen per Klick einfügen:** Wählt man in der rechten Seitenleiste unter *„Verfügbare dynamische Variablen“* einen Chip (z. B. `+[Platz-Bezeichnung]`), wird dieser direkt in den Betreff eingefügt.
    - **Kopfzeile (Wappen/Logo & 2 getrennte Textfelder):**
      - Über das „+“-Menü kann der Baustein *„Kopfzeile“* eingefügt werden (im Canvas mit der klaren Plakette *„KOPFZEILE“* gekennzeichnet).
      - **Feste 2-Spalten-Struktur:**
        - *Links (Wappen/Logo):* Ein dezentes Platzhalterfeld für das Vereins-Wappen bzw. Logo mit der Aufschrift *„Wappen/Logo – Klicken zum Hochladen“*. Das Logo ist innerhalb seines Blockabschnitts immer horizontal und vertikal zentriert.
        - *Rechts (2 getrennte Eingabefelder):*
          1. *Vereinsname:* Oben platziertes Eingabefeld (groß & fett formatiert) mit Platzhalter *„Vereinsname“*.
          2. *Untertitel:* Darunter platziertes Eingabefeld (dezenter formatiert) mit Platzhalter *„Untertitel“*.
      - **Klare, ruhige Gestaltung:** Sämtliche Hilfstexte wie *„Spalte 1“* oder *„Spalte 2“* sowie störende gestrichelte Umrandungen wurden entfernt. Der eingegebene Text erscheint direkt im Eingabefeld ohne doppelte Anzeige darunter.
      - **Fester Spaltenabstand (0 px):** Der Abstand zwischen Wappen und Text ist fest auf 0 px definiert, um einen nahtlosen, bündigen Übergang zu gewährleisten.
      - **Geschützte Struktur:** Die Option zum Hinzufügen weiterer Unterelemente oder 3. Spalten wurde entfernt, sodass das Kopfzeilen-Layout auf allen Geräten dauerhaft stabil und professionell bleibt.
      - **Seitenleiste (Inspector):**
        - *Spaltenbreite / Verteilung:* Über einen stufenlosen Schieberegler kann das Breitenverhältnis direkt justiert werden (z. B. *„Wappen/Logo (25%) • Text (75%)“* im Bereich von 15% bis 85%).
        - *Hintergrundbild:* Über den Button *„Hintergrundbild hochladen“* kann ein eigenes Banner bzw. Motiv eingebunden werden (`cover`-Füllung). Die Hintergrundfarbe bleibt darunter als Tönung/Fallback wählbar.
        - *Feste Zentrierung:* Wappen/Logo und Textzeilen sind immer fest vertikal zentriert – ein manueller Auswahlschalter ist nicht mehr erforderlich.
        - *Getrennte Text-Formatierung (Vereinsname & Untertitel):* Für beide Zeilen stehen separate Werkzeuge zur Verfügung:
          - *Schriftart:* System Sans, Arial, Trebuchet MS, Georgia, Times New Roman, Courier New, Verdana.
          - *Schriftgröße:* Feine Justierung per Stepper (+ / -).
          - *Textfarbe:* Color-Picker, Hex-Eingabe sowie dynamische Farbfelder direkt aus den im Admin-Bereich hinterlegten Vereinsfarben.
        - *Innenabstand:* Schieberegler für den oberen und unteren Abstand der Kopfzeile.
    - **Aufgeräumte Seitenleiste (Inspector):** Die rechte Leiste konzentriert sich bei Vorlageneinstellungen auf globale Schriftarten und Event-Ziele bzw. auf die Eigenschaften des jeweils ausgewählten Blocks, ohne redundante Betreffeingabefelder.

### Persönliche Benachrichtigungs-Einstellungen (Spieler-Profil)
Jedes Vereinsmitglied kann seine Benachrichtigungen im persönlichen Profil selbstständig verwalten:
- **Profil aufrufen:** Klick auf den eigenen Benutzernamen bzw. Avatar in der oberen Navigationsleiste öffnet das Fenster *„Profil bearbeiten“*.
- **Einklappbare Sektion „Benachrichtigungen“:**
  - Standardmäßig eingeklappt, um das Profil kompakt zu halten. Ein Klick auf das Akkordeon klappt die 5 Kategorien auf.
  - Zeigt auf einen Blick die Anzahl der aktiven Benachrichtigungen (z. B. *„5 von 5 E-Mail-Kategorien aktiv“*).
  - Jede Kategorie kann einzeln per Checkbox aktiviert oder abbestellt werden:
    1. *Buchungsbestätigung*
    2. *Buchungsstornierung*
    3. *Buchungsänderung*
    4. *Neuer Hobbyliga-Beitrag*
    5. *Match-Ergebnis eingetragen*
- **Abhängigkeit zum Vereins-Master-Schalter & Not-Aus:**
  - Ist der gesamte E-Mail-Versand vom Verein über den Not-Aus pausiert, werden alle Checkboxen im Profil mit dem Hinweis *„(Der E-Mail-Versand ist vom Verein derzeit vollständig pausiert)“* gesperrt.
  - Hat der Administrator ein einzelnes Event über den Master-Kill-Switch deaktiviert, wird die entsprechende Checkbox im Profil mit dem Hinweis *„(Vom Verein derzeit global deaktiviert)“* gesperrt.
- **Persistente Speicherung:** Die getroffenen Auswahlen werden beim Speichern des Profils direkt im Benutzerkonto hinterlegt.

- **Spezifische Event-Logik & Empfänger-Filterung:**
  - *`HOBBYLIGA_NEW_POST` (Hobbyliga: Neuer Beitrag):* Broadcast-Benachrichtigung an alle aktiven Teilnehmer der Hobbyliga, sobald ein neuer Pinnwand-Beitrag erstellt wird. Der Verfasser des Beitrags wird automatisch und strikt aus dem Empfängerkreis ausgeschlossen.
  - *`MATCH_RESULT_SUBMITTED` (Match-Ergebnis eingetragen):* Geht nach der Ergebniseingabe eines Matches strikt und ausschließlich an den gegnerischen Spieler. Der eintragende Spieler selbst erhält niemals eine redundante E-Mail.
  - *`RESERVATION_CONFIRMED` / `RESERVATION_CANCELLED`:* Bestätigungs- und Stornierungs-E-Mails bei Buchungsvorgängen.

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

