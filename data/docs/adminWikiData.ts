export interface AdminWikiArticle {
  id: string;
  title: string;
  summary: string;
  content: string; // Markdown formatted text
  keywords: string[];
}

export interface AdminWikiCategory {
  id: string;
  title: string;
  iconName: string; // Lucide icon identifier
  description: string;
  articles: AdminWikiArticle[];
}

export const ADMIN_WIKI_CATEGORIES: AdminWikiCategory[] = [
  {
    id: 'mitgliederverwaltung-sperren',
    title: 'Mitgliederverwaltung & Sperren',
    iconName: 'Users',
    description: 'Benutzerkonten anlegen, Rollen (Super-Admin, Haupt-Admin, Admin, Mitglied), Kontosperren, Onboarding & DSGVO-Bereinigung.',
    articles: [
      {
        id: 'rollen-berechtigungen',
        title: 'Benutzerrollen & Berechtigungskonzept',
        summary: 'Die vierstufige Hierarchie von Super-Admin bis regulärem Mitglied.',
        keywords: ['rollen', 'berechtigungen', 'superadmin', 'hauptadmin', 'admin', 'mitglied', 'rechte'],
        content: `### Rollenhierarchie im Mandantensystem

Das System unterscheidet folgende Berechtigungsstufen:

1. **Super-Administrator (\`super-admin\`):**
   - Höchste Systemebene mit mandantenübergreifender Gesamtverwaltung.
   - Zugriff auf das Super-Admin-Dashboard, globale Mandantenverwaltung, globale Backups und endgültige DSGVO-Benutzerbereinigung (Papierkorb).
2. **Haupt-Administrator (\`hauptAdmin: true\`):**
   - Vereinsinterner Hauptverantwortlicher (z. B. 1. Vorstand oder Sportwart).
   - Kann andere Administratoren für den Verein ernennen oder deren Admin-Rechte entziehen.
3. **Administrator (\`admin\`):**
   - Verwaltung von Vereins-Einstellungen, Platzsperren, Buchungs-Reports, Gastspiel-Abrechnungen, Turnieren und News.
4. **Mitglied / Spieler (\`mitglied\` / \`spieler\`):**
   - Reguläre Berechtigung zur Platzbuchung, Ranglistenteilnahme, Meisterschafts- und Profilverwaltung.`
      },
      {
        id: 'mitglieder-anlegen-importieren',
        title: 'Mitglieder anlegen, editieren & Excel-Import',
        summary: 'Neuanlage von Einzelmitgliedern sowie automatisierter Massenimport aus Vereinsverwaltungen.',
        keywords: ['anlegen', 'import', 'excel', 'csv', 'benutzer', 'mitgliederliste', 'passwort'],
        content: `### Mitgliederverwaltung in der Praxis

- **Einzelne Mitglieder anlegen:** Im Bereich **Mitgliederverwaltung** auf **„+ Neues Mitglied“** klicken. Pflichtangaben sind Vorname, Nachname, Benutzername und ein Anfangspasswort (mind. 8 Zeichen).
- **Excel- / CSV-Massenimport:** Über den Button **„Importieren“** können Adresslisten aus gängigen Vereinsverwaltungsprogrammen (z. B. NetTennis, ClubDesk, BLSV) importiert werden. Das System mappt automatisch Spalten wie Name, E-Mail, Telefon und Geburtsdatum.
- **Platzhalter-E-Mails:** Bei Mitgliedern ohne eigene E-Mail-Adresse erzeugt das System automatisch eine interne Platzhalter-Adresse (\`vorname.nachname@verein.internal\`), damit alle Authentifizierungsprozesse stabil durchlaufen.`
      },
      {
        id: 'konten-sperren-entsperren',
        title: 'Kontosperren & Inaktivität (isSuspended)',
        summary: 'Temporäre Buchungssperren bei Beitragsrückständen oder Vereinsaustritt.',
        keywords: ['sperren', 'entsperren', 'kontosperre', 'suspended', 'buchungssperre', 'inaktiv'],
        content: `### Sperrmechanismus für Buchungen

Administratoren können einzelne Mitglieder mit sofortiger Wirkung für Buchungen sperren:
- In der Mitgliederliste bei der gewünschten Person auf **Bearbeiten** klicken und den Haken **„Konto sperren / Buchungssperre aktiv“** (\`isSuspended\`) aktivieren.
- **Auswirkung:** Das Mitglied kann sich weiterhin anmelden, sieht jedoch einen unmissverständlichen Hinweistext und kann keine neuen Plätze reservieren oder als Partner ausgewählt werden.
- Bereits bestehende Buchungen können von Administratoren storniert oder manuell übertragen werden.`
      },
      {
        id: 'onboarding-konfiguration',
        title: 'Saisonales Onboarding, ACE-Begrüßung & Stapelaktionen',
        summary: 'Steuerung des Begrüßungsfensters, ACE-Callout und globale Reset-Funktionen zum Saisonstart.',
        keywords: ['onboarding', 'saisonstart', 'begrüßungsfenster', 'batch', 'stapelaktion', 'pflichtfelder', 'ace', 'sprechblase'],
        content: `### Onboarding-Zentrale für Administratoren

Unter **Einstellungen ➔ Mitglieder-Onboarding** kann der Begrüßungsdialog gesteuert werden:
- **Feld-Konfiguration:** Jedes Stammdatenfeld (Geburtsdatum, Geschlecht, Telefon, E-Mail, Passwort) kann einzeln auf *„Frei bearbeitbar“*, *„Schreibgeschützt“* oder *„Ausgeblendet“* geschaltet werden.
- **ACE Onboarding-Sprechblase (Willkommens-Callout):**
  - Sobald ein Mitglied sein Erst-Onboarding bestätigt, zeigt das System über dem schwebenden Maskottchen-Button eine dezente Sprechblase (*„Hi, ich bin ACE! 👋“*).
  - Der Status wird über das Benutzerprofil (\`has_seen_ace_welcome: true\`) und im LocalStorage dauerhaft gespeichert, sodass der Hinweis garantiert nur einmalig pro Benutzerlebenszeit erscheint.
  - Das Element blendet sich nach 8 Sekunden selbstständig aus oder schließt sich per Klick.
- **Stapelverarbeitung (Batch-Reset):**
  - **„Für alle einschalten“:** Setzt clubweit bei allen Mitgliedern \`onboarding_pending: true\`. Beim nächsten Einloggen muss jeder Spieler seine Stammdaten bestätigen (ideal zur Frühjahrssaison).
  - **„Für alle ausschalten“:** Schaltet das Onboarding für alle Mitglieder sofort auf erledigt.`
      },
      {
        id: 'dsgvo-loeschung-papierkorb',
        title: 'DSGVO-Löschung & Papierkorb mit 30-Tage-Frist',
        summary: 'Rechtssichere Benutzerbereinigung mit Wiederherstellungsmöglichkeit.',
        keywords: ['dsgvo', 'löschen', 'papierkorb', 'purge', 'wiederherstellen', 'datenschutz'],
        content: `### Papierkorb & Endgültige Bereinigung

- Gelöschte Benutzer werden zunächst in den virtuellen Papierkorb verschoben (\`isDeleted: true\`, \`deletedAt\`).
- Innerhalb von **30 Tagen** kann der Administrator einen versehentlich gelöschten Account mit allen historischen Spiel- und Buchungsdaten wiederherstellen.
- Im Super-Admin-Dashboard unter **„Benutzerbereinigung / Purge“** können abgelaufene Konten nach Ablauf der Aufbewahrungsfrist unwiderruflich aus Firestore bereinigt werden.`
      }
    ]
  },
  {
    id: 'plaetze-zeiten-konfigurieren',
    title: 'Plätze & Zeiten konfigurieren',
    iconName: 'LayoutGrid',
    description: 'Plätze anlegen, Beläge (Sand/Halle), Zeitraster, Buchungsfristen, Ballmaschine & Platzsperren.',
    articles: [
      {
        id: 'plaetze-verwalten',
        title: 'Plätze anlegen, benennen & sortieren',
        summary: 'Verwaltung der verfügbaren Court-Kapazitäten und Platzmerkmale.',
        keywords: ['plätze', 'court', 'sandplatz', 'halle', 'hartplatz', 'anlage', 'anzahl'],
        content: `### Platz-Konfiguration

Unter **Einstellungen ➔ Plätze**:
- **Plätze hinzufügen / entfernen:** Passe die Anzahl der verfügbaren Tennisplätze an.
- **Platzbezeichnungen:** Standardmäßig nummeriert (z. B. „Platz 1“, „Platz 2“); individuelle Namen wie „Centercourt“ oder „Halle A“ sind jederzeit möglich.
- **Bodenbelag & Eigenschaften:** Festlegung des Belags (Sand, Kunstrasen, Allwetter, Granulat/Teppich) und Kennzeichnung, ob auf dem Platz eine elektronische Ballmaschine montiert ist.`
      },
      {
        id: 'zeitraster-saisonzeiten',
        title: 'Zeitraster, Öffnungszeiten & Saisonstart',
        summary: 'Tägliche Buchungszeiten von 07:00 bis 22:00 Uhr und Slot-Dauer (60 / 90 Minuten).',
        keywords: ['zeitraster', 'slots', 'stunden', 'öffnungszeiten', 'dauer', '60min'],
        content: `### Zeitfenster & Kalendereinstellungen

- **Tägliche Spanne:** Das Standardraster beginnt um 07:00 oder 08:00 Uhr und endet bei Einbruch der Dunkelheit bzw. Hallenschließung um 21:00 oder 22:00 Uhr.
- **Slot-Länge:** In der Regel 60 Minuten für Einzelslots. Das System unterstützt flexible Startzeiten im vollen Stundentakt.
- **Saison-Zeitraum:** Über die Vereinseinstellungen kann das offizielle Datum für den Saisonauftakt (Frühjahr) und das Saisonende (Herbst) hinterlegt werden.`
      },
      {
        id: 'vorausbuchung-limits',
        title: 'Vorausbuchungsfristen & Buchungslimits',
        summary: 'Verhindere die Blockade von Plätzen durch zu weite Vorabbuchungen.',
        keywords: ['limit', 'vorausbuchung', 'tage', 'parallel', 'maximum', 'kontingent'],
        content: `### Regeln gegen Platzhamstern

Unter **Einstellungen ➔ Reservierungsregeln**:
- **Maximale Vorausbuchung:** Legt fest, wie viele Tage im Voraus ein Mitglied Plätze buchen darf (z. B. maximal 3 oder 7 Tage im Voraus).
- **Parallele Buchungen:** Begrenzung auf z. B. 1 oder 2 zeitgleiche Vorabbuchungen pro Mitglied. Erst wenn das gebuchte Match beendet ist, wird das Kontingent wieder freigegeben.
- **Buchungen am selben Tag:** Für spontanes Spielen am aktuellen Tag können gesonderte Freiheiten ohne Kontingentabzug gewährt werden.`
      },
      {
        id: 'platzsperren-pflege',
        title: 'Platzsperren (Witterung, Pflege, Punktspiele)',
        summary: 'Gezielte Sperrung einzelner Plätze oder der Gesamtanlage für Turniere, Jugendtraining oder Regen.',
        keywords: ['platzsperre', 'sperren', 'regen', 'unbespielbar', 'medenspiel', 'training'],
        content: `### Manuelle & globale Platzsperren

Administratoren können Plätze jederzeit für die allgemeine Buchung sperren:
- **Im Belegungsplan:** Klicke auf den gewünschten Zeitslot und wähle im Slider den Modus **„Sperre / Reserviert für Verein“**.
- **Sperrgründe:** Trage einen transparenten Grund ein (z. B. *„Punktspiel Herren 40“*, *„Platzwart-Pflege / Walzen“*, *„Wegen Dauerregen unbespielbar“*).
- **Farbliche Kennzeichnung:** Gesperrte Slots werden rot hinterlegt mit gut lesbarem Schloss-Icon und Sperrgrund dargestellt.`
      }
    ]
  },
  {
    id: 'sonderbuchungen-ligen',
    title: 'Sonderbuchungen & Ligen',
    iconName: 'Shield',
    description: 'Veranstaltungen & Turniere, Vereinsmeisterschaften, Hobbyligen, Ranglisten & öffentliche Wochenpläne.',
    articles: [
      {
        id: 'veranstaltungen-turniere',
        title: 'Veranstaltungen & Events anlegen',
        summary: 'Club-Turniere, Schleifchenturniere und Sommerfeste mit Anmeldefristen und Audit-Log.',
        keywords: ['veranstaltung', 'event', 'turnier', 'anmeldung', 'audit', 'teilnehmer', 'header'],
        content: `### Event-Management direkt auf der Veranstaltungs-Seite

- **Einheitlicher Bento-Header:** Die Veranstaltungsansicht verfügt über eine einheitliche Kopfzeile mit Icon (Party-Popper) und Untertitel analog zur Rangliste. Administratoren finden direkt im Header den Schnellzugriff **„Neues Event“**.
- **Neues Event anlegen:** Klicke auf der Veranstaltungs-Seite auf **„Neues Event“**. Es öffnet sich der Slider zur Eingabe von Titel, Datum, Beschreibung, maximaler Teilnehmerzahl und Anmeldeschluss.
- **Kommentarfeld bei Anmeldung:** Ermöglicht es Spielern, Essenswünsche, T-Shirt-Größen oder Leistungsklassen anzugeben.
- **Audit-Log (Revisionssicher):** Über den Button **„Audit“** können Administratoren lückenlos nachvollziehen, wann sich welches Mitglied an- oder abgemeldet hat.
- **Papierkorb:** Gelöschte Events bleiben 30 Tage im Archiv wiederherstellbar.`
      },
      {
        id: 'vereinsmeisterschaft-admin',
        title: 'Vereinsmeisterschaften (Turnier-Vorlagen & Phasen-Pipeline)',
        summary: 'Strukturierte Turniere mit Vorlagen, Gruppenphasen, K.-o.-Bäumen und Finaltagen organisieren.',
        keywords: ['meisterschaft', 'pipeline', 'vorlage', 'gruppenphase', 'k.o.', 'finaltag', 'baum'],
        content: `### Meisterschafts-Zentrale im Admin-Bereich

Im Bereich **Einstellungen ➔ Meisterschaft**:
- **Turnier-Vorlagen (In-Page-Editor):** Erstelle wiederverwendbare Turnierformate (z. B. *Einzel Herren*, *Doppel Damen*).
- **Phasen-Pipeline & UX:** Konfiguriere chronologisch von oben nach unten:
  1. *Gruppenphase:* Anzahl Gruppen und Spieler pro Gruppe. Die Tabelle führt Sätze und Spiele inklusive Differenz kompakt zusammen (\`4:2 (+2)\`, \`36:24 (+12)\`).
  2. *K.-o.-Stufen:* Halbfinale mit eigener Frist (*„Zu spielen bis“*). In der Teilnehmeransicht werden Partien fokussiert je Phase unter der Überschrift *„Begegnungen [Phasenname]“* (z. B. *Begegnungen Halbfinale*) dargestellt.
  3. *Finaltag:* Modulare Ausspielung aller Plätze (Großes Finale um Platz 1 & 2, Kleines Finale um Platz 3) mit konkretem Event-Datum (*„Begegnungen Endrunde / Finaltag“*).
  4. *Performante Animationen:* Der Wechsel zwischen den Phasen sowie zwischen Ranglisten-Kategorien erfolgt über eine hardwarebeschleunigte 150-ms-Fade-Animation (AnimatePresence), die harte Übergänge vermeidet und gleichzeitig sofort reagiert.
- **Vorlagenschutz:** Vorlagen, die in laufenden Meisterschaften aktiv sind, werden schreibgeschützt gesperrt, um Ergebnisverfälschungen zu verhindern.`
      },
      {
        id: 'hobbyliga-rangliste',
        title: 'Hobbyliga & Forderungs-Rangliste',
        summary: 'Pyramiden-Rangliste und Hobbyliga mit provisorischen Ergebnissen und Verfallsfristen.',
        keywords: ['hobbyliga', 'rangliste', 'pyramide', 'forderung', 'provisorisch', 'bestätigen'],
        content: `### Spielbetrieb im Verein fördern

- **Forderungs-Pyramide:** Mitglieder fordern weiter oben platzierte Spieler heraus. Bei Sieg tauschen beide Spieler die Positionen.
- **Hobbyliga-Punkteberechnung:** Spiele fließen in die automatisierte Hobbyliga-Wertung ein.
- **Provisorische Ergebnisse:** Nach Eingabe eines Ergebnisses durch einen Spieler hat der Gegner ein Zeitfenster zur Bestätigung. Erfolgt kein Widerspruch, wird das Ergebnis automatisch endgültig gewertet.`
      },
      {
        id: 'oeffentlicher-wochenplan-feeds',
        title: 'Öffentlicher Wochenplan & Buchungs-Feeds',
        summary: 'Freigabe von Kalendern für Vereinshomepages oder digitale Infostelen im Clubheim.',
        keywords: ['öffentlich', 'wochenplan', 'feed', 'ical', 'homepage', 'infostele', 'djk'],
        content: `### Öffentliche Schnittstellen & Display-Modus

- **Öffentlicher Wochenplan (\`/public/wochenplan\`):** Ermöglicht die Einbindung des Belegungsplans auf der Vereinshomepage oder auf einem Touchscreen-Terminal im Clubheim ohne Login.
- **Schnellbuchungs-Trichter:** Besucher können direkt auf freie Plätze tippen; nach schneller Passworteingabe wird die Reservierung gebucht.
- **Sicherheits-Status 403:** Wird ein Feed im Admin-Menü deaktiviert, antwortet die Schnittstelle mit einem standardkonformen \`403 Forbidden\`, statt unberechtigte Aufrufer zur Anmeldeseite umzuleiten.`
      }
    ]
  },
  {
    id: 'system-parameter-tarife',
    title: 'System-Parameter & Tarife',
    iconName: 'Settings',
    description: 'Modulsteuerung, Gastspiel-Tarifmodelle, Arbeitseinsatz-Timelines, Immutable-Rate-Konzept & Club-Branding.',
    articles: [
      {
        id: 'modulare-systemsteuerung',
        title: 'Modulare Systemsteuerung & Kernfunktionen',
        summary: 'Module global ein- oder ausschalten (Gäste, Meisterschaft, Rangliste, Arbeitseinsätze).',
        keywords: ['module', 'systemsteuerung', 'deaktivieren', 'aktivieren', 'ausblenden', 'schalter'],
        content: `### Modulare Systemarchitektur

In den **Allgemeinen Einstellungen** unter **Module aktivieren**:
- **Veranstaltungen:** Blendet den Turnierkalender global ein oder aus.
- **Gastspiele:** Ermöglicht oder verbietet die Buchung mit vereinsfremden Gastspielern.
- **Rangliste:** Aktiviert die Forderungs-Pyramide.
- **Meisterschaft:** Schaltet den Pokal-Reiter für Vereinsmeisterschaften frei.
- **Arbeitseinsätze:** Steuert die Erfassung von Helferstunden auf dem Dashboard.
- **Architektonische Garantie:** Bereits vorhandene Daten werden beim Deaktivieren eines Moduls niemals gelöscht, sondern bleiben geschützt in Firestore erhalten.`
      },
      {
        id: 'gastspiel-berechnungsmodi',
        title: 'Gastspielabrechnung & Tarifmodelle',
        summary: 'Platzbasis (Pauschal) vs. Spielerbasis (Personenbezogen) und Timeline-Steuerung.',
        keywords: ['gastspiel', 'tarif', 'berechnung', 'platzbasis', 'spielerbasis', 'gebühr'],
        content: `### Die beiden mathematischen Berechnungsmodi

In den Gastspiel-Einstellungen kann zwischen zwei Verrechnungsmethoden gewählt werden:

1. **Modus Platzbasis (Pauschal):**
   - Die Gebühr fällt einmalig pro gebuchte Stunde an, unabhängig davon, ob 1, 2 oder 3 Gäste auf dem Platz stehen.
   - \`Gebühr = Stundensatz * Buchungsdauer\`
   - *Beispiel:* 2 Stunden à 10 € = 20,00 €.

2. **Modus Spielerbasis (Personenbezogen):**
   - Die Gebühr multipliziert sich mit der Anzahl der anwesenden Gäste.
   - \`Gebühr = Stundensatz * Buchungsdauer * Gästeanzahl\`
   - *Beispiel:* 2 Stunden mit 2 Gästen à 5 €/Std. = 20,00 €.`
      },
      {
        id: 'arbeitseinsatz-jahres-timeline',
        title: 'Die „Gültig Ab“-Timeline für Arbeitseinsätze',
        summary: 'Historische Interpolation verhindert rückwirkende Verfälschungen alter Saisonjahre.',
        keywords: ['timeline', 'arbeitseinsatz', 'helferstunden', 'gültig ab', 'interpolation', 'ersatzgebühr'],
        content: `### Chronologische Jahres-Timeline

Vereine passen Pflichtstunden oder Stundensätze gelegentlich an (z. B. Erhöhung von 10 auf 12 Stunden im Jahr 2026):
- **Historische Interpolation:** Das System sucht für ein gewähltes Kalenderjahr rückwärts in der Timeline nach der ersten Regel mit \`Startjahr <= Zieljahr\`.
- **Zukunftssicherheit:** Administratoren können bereits im Herbst die neuen Tarife für die kommende Saison hinterlegen, ohne laufende Berechnungen des aktuellen Jahres zu verfälschen.
- **System-Fallback:** Ist die Timeline komplett leer, greifen 10 Pflichtstunden und 15,00 € Ersatzgebühr als Ausfallsicherung.`
      },
      {
        id: 'immutable-rate-konzept',
        title: 'Historische Datensicherheit & Immutable-Rate-Konzept',
        summary: 'Revisionssichere Finanzreports durch Snapshot-Sicherung in Buchungen.',
        keywords: ['snapshot', 'immutable', 'datensicherheit', 'revisionssicher', 'finanzen', 'report'],
        content: `### Schutz historischer Finanzberichte

- **Buchungsspezifischer Snapshot:** Bei jeder Buchung mit Gästen wird der zum Buchungszeitpunkt gültige Tarif als feste Momentaufnahme (\`guestFee\`, \`guestBillingMode\`) direkt in das Buchungsdokument geschrieben.
- **Priorität bei der Report-Generierung:**
  1. Nutze Buchungs-Snapshot (falls vorhanden).
  2. ELSE: Ermittle Tarif via Jahres-Timeline interpoliert für das Buchungsdatum.
  3. ELSE: Nutze globalen Standard-Fallback.
- **Ergebnis:** Auch wenn Tarife Jahre später angepasst werden, bleiben die Umsätze alter Geschäftsjahre exakt unverändert.`
      },
      {
        id: 'club-branding-design',
        title: 'Club-Branding, Farbwelten & Desktop Bento-Layout',
        summary: 'Anpassung von Primär- und Akzentfarben, Logos, Favicon, Begrüßungsbannern und Bento-Grid Spacing.',
        keywords: ['branding', 'design', 'farben', 'logo', 'banner', 'anpassung', 'verein', 'bento', 'spacing', 'raster'],
        content: `### Visuelle Identität & Desktop Bento-Layout

Unter **Einstellungen ➔ Design & Layout**:
- **Farben:** Frei wählbare Primär- und Akzentfarben (inklusive automatischer Kontrastüberprüfung für Buttons und Menüleisten).
- **Logos & Banner:** Upload für Vereinswappen (Header), Favicon (Browser-Tab) sowie stimmungsvolle Hintergrundbilder für die Anmeldeseite.
- **Bento-Grid & Spacing-Harmonisierung (Desktop):** Alle Hauptansichten und Administrationsbereiche folgen einheitlichen Design-Tokens (horizontale und vertikale Abstände einheitlich 16–20px, Sektionsabstände 16–24px), sodass Dashboards und Sidebars ohne überbreite Lücken kompakt und übersichtlich wirken.
- **Multi-Tenant URL:** Automatische Erkennung des Vereinsnamens anhand der Subdomain oder des URL-Pfads.`
      }
    ]
  }
];

/**
 * Returns a consolidated plain-text representation of the Admin Wiki.
 */
export function getAdminWikiPlainText(): string {
  let output = '=== OFFIZIELLES ADMINISTRATOREN-HANDBUCH & WIKI ===\n\n';

  ADMIN_WIKI_CATEGORIES.forEach((cat, cIdx) => {
    output += `====================================================\n`;
    output += `KAPITEL ${cIdx + 1}: ${cat.title.toUpperCase()}\n`;
    output += `Beschreibung: ${cat.description}\n`;
    output += `====================================================\n\n`;

    cat.articles.forEach((art) => {
      output += `[ABSCHNITT: ${art.title}]\n`;
      output += `Kurzfassung: ${art.summary}\n`;
      output += `Stichworte: ${art.keywords.join(', ')}\n\n`;
      output += `${art.content}\n\n`;
    });
  });

  return output;
}

export const ADMIN_WIKI_PLAIN_TEXT = getAdminWikiPlainText();
