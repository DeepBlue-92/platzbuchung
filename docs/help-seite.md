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
- **Hauptschalter (Master Switch):** Bestimmt, ob das Begrüßungsfenster für Mitglieder beim Login überhaupt aufgerufen wird.
- **Felder anpassen:** Für jedes persönliche Profilfeld (wie Vorname, Nachname, Telefon, Geschlecht, Geburtsdatum, Passwort) kann der Verein einstellen, ob das Feld frei bearbeitbar, nur lesbar oder komplett ausgeblendet sein soll.
- **Modernes Split-Design:** Auf Laptops und Computern erscheint das Begrüßungsfenster in einem breiten zweigeteilten Layout. Links begrüßt eine sanfte Tennis-Animation zusammen mit dem Willkommenstext das Mitglied. Rechts befinden sich die persönlichen Datenfelder in übersichtlichen Kacheln.
- **Smartphone-Optimierung:** Auf Mobiltelefonen wird die Animation automatisch ausgeblendet, damit das Display nicht überladen wird und alle Eingabefelder direkt erreichbar sind.
- **Bestätigen & Hinweis ausblenden:** Am unteren Rand des Formulars befindet sich ein Kontrollkästchen mit der Beschriftung *„Diesen Hinweis nicht mehr anzeigen“* (standardmäßig nicht angehakt). Setzt das Mitglied dort einen Haken und klickt auf *Bestätigen & Weiter*, wird das Begrüßungsfenster bei zukünftigen Anmeldungen nicht mehr angezeigt.
- **Stapelverarbeitung (Onboarding zurücksetzen):** Mit dem Knopf *Für alle Mitglieder zurücksetzen* können Administratoren mit einem Klick veranlassen, dass alle Mitglieder des Vereins beim nächsten Einloggen erneut durch den Datenabgleich und das Begrüßungsfenster geführt werden.
- **Erfolgs- und Fehlermeldungen:** Nach dem Speichern oder Zurücksetzen zeigt ein klarer Infobalken direkt an, ob die Aktion erfolgreich war oder ob fehlende Berechtigungen vorliegen.

