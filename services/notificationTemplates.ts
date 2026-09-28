import { EmailTemplate, TemplateVariableInfo, NotificationEventDefinition, UserNotificationSettings, TemplateBlock } from "../types/notifications";

/**
 * All configurable notification event definitions in standard display order:
 * 1. Buchungsbestätigung
 * 2. Buchungsstornierung
 * 3. Buchungsänderung
 * 4. Neuer Hobbyliga-Beitrag
 * 5. Match-Ergebnis eingetragen
 */
export const NOTIFICATION_EVENT_DEFINITIONS: NotificationEventDefinition[] = [
  {
    key: "RESERVATION_CONFIRMED",
    label: "Buchungsbestätigung",
    category: "booking",
    description: "Wird unmittelbar nach erfolgreicher Platzreservierung an das Mitglied versendet.",
    defaultEnabled: true,
    targetAudience: "Buchendes Mitglied",
  },
  {
    key: "RESERVATION_CANCELLED",
    label: "Buchungsstornierung",
    category: "booking",
    description: "Wird versendet, wenn ein Mitglied oder Administrator eine Buchung storniert.",
    defaultEnabled: true,
    targetAudience: "Buchendes Mitglied",
  },
  {
    key: "RESERVATION_MODIFIED",
    label: "Buchungsänderung",
    category: "booking",
    description: "Wird versendet, wenn ein Mitglied oder Administrator eine bestehende Buchung bearbeitet (z. B. Platz, Datum, Uhrzeit oder Mitspieler).",
    defaultEnabled: true,
    targetAudience: "Buchendes Mitglied & Mitspieler",
  },
  {
    key: "HOBBYLIGA_NEW_POST",
    label: "Neuer Hobbyliga-Beitrag",
    category: "hobbyliga",
    description: "Broadcast-Benachrichtigung an alle Liga-Teilnehmer bei neuem Pinnwand-Beitrag (außer Verfasser).",
    defaultEnabled: true,
    targetAudience: "Alle Hobbyliga-Teilnehmer (exkl. Verfasser)",
  },
  {
    key: "MATCH_RESULT_SUBMITTED",
    label: "Match-Ergebnis eingetragen",
    category: "matches",
    description: "Benachrichtigung über ein eingetragenes Spielergebnis (geht strikt nur an den gegnerischen Spieler).",
    defaultEnabled: true,
    targetAudience: "Nur gegnerischer Spieler",
  },
];

export const DEFAULT_USER_NOTIFICATION_SETTINGS: UserNotificationSettings = {
  RESERVATION_CONFIRMED: true,
  RESERVATION_CANCELLED: true,
  RESERVATION_MODIFIED: true,
  HOBBYLIGA_NEW_POST: true,
  MATCH_RESULT_SUBMITTED: true,
};

export const DEFAULT_SYSTEMWIDE_NOTIFICATION_SETTINGS: Record<string, boolean> = {
  RESERVATION_CONFIRMED: true,
  RESERVATION_CANCELLED: true,
  RESERVATION_MODIFIED: true,
  HOBBYLIGA_NEW_POST: true,
  MATCH_RESULT_SUBMITTED: true,
};

/**
 * Registry of all available template variables and placeholders.
 */
export const AVAILABLE_TEMPLATE_VARIABLES: TemplateVariableInfo[] = [
  {
    key: "user_name",
    placeholder: "{{user_name}}",
    label: "Spieler-Name",
    description: "Vollständiger Name des Empfängers (z. B. Max Mustermann)",
    example: "Max Mustermann",
  },
  {
    key: "court_name",
    placeholder: "{{court_name}}",
    label: "Platz-Bezeichnung",
    description: "Name des reservierten Platzes (z. B. Platz 1 (Sandplatz))",
    example: "Platz 1 (Center Court)",
  },
  {
    key: "date",
    placeholder: "{{date}}",
    label: "Datum",
    description: "Datum der Spielzeit (z. B. 15.06.2026)",
    example: "15.06.2026",
  },
  {
    key: "time",
    placeholder: "{{time}}",
    label: "Uhrzeit",
    description: "Uhrzeit oder Zeitslot (z. B. 18:00 - 19:00 Uhr)",
    example: "18:00 - 19:00 Uhr",
  },
  {
    key: "old_court_name",
    placeholder: "{{old_court_name}}",
    label: "Vorheriger Platz",
    description: "Platz vor der Umbuchung (z. B. Platz 2)",
    example: "Platz 2",
  },
  {
    key: "old_date",
    placeholder: "{{old_date}}",
    label: "Vorheriges Datum",
    description: "Datum vor der Umbuchung (z. B. 14.06.2026)",
    example: "14.06.2026",
  },
  {
    key: "old_time",
    placeholder: "{{old_time}}",
    label: "Vorherige Uhrzeit",
    description: "Uhrzeit vor der Umbuchung (z. B. 17:00 - 18:00 Uhr)",
    example: "17:00 - 18:00 Uhr",
  },
  {
    key: "players",
    placeholder: "{{players}}",
    label: "Mitspieler / Partner",
    description: "Liste der eingetragenen Spieler",
    example: "Max Mustermann, Steffi Graf",
  },
  {
    key: "cancellation_link",
    placeholder: "{{cancellation_link}}",
    label: "Stornierungs-Link",
    description: "Direkter Link zur Stornierung oder Buchungsübersicht",
    example: "https://tennis-club.de/my-bookings?cancel=b-12345",
  },
  {
    key: "club_name",
    placeholder: "{{club_name}}",
    label: "Vereinsname",
    description: "Offizieller Name des Tennisvereins",
    example: "TC Tennis-Club e.V.",
  },
  {
    key: "booking_id",
    placeholder: "{{booking_id}}",
    label: "Buchungs-Nummer",
    description: "Eindeutige ID der Buchung",
    example: "BK-2026-0849",
  },
  {
    key: "league_name",
    placeholder: "{{league_name}}",
    label: "Liga-Name",
    description: "Name der Hobbyliga (z. B. Herren Einzel A)",
    example: "Hobbyliga Herren A",
  },
  {
    key: "author_name",
    placeholder: "{{author_name}}",
    label: "Verfasser-Name",
    description: "Name des Autors des Pinnwand-Beitrags",
    example: "Boris Becker",
  },
  {
    key: "post_title",
    placeholder: "{{post_title}}",
    label: "Beitrags-Titel",
    description: "Titel oder Überschrift des Beitrags",
    example: "Spielpartner für Samstag gesucht",
  },
  {
    key: "post_content",
    placeholder: "{{post_content}}",
    label: "Beitrags-Text",
    description: "Inhalt des Beitrags auf der Pinnwand",
    example: "Hallo zusammen, wer hat Lust am Samstag um 10 Uhr eine Runde zu spielen?",
  },
  {
    key: "league_link",
    placeholder: "{{league_link}}",
    label: "Hobbyliga-Link",
    description: "Direkter Link zur Hobbyliga-Übersicht",
    example: "https://tennis-club.app/hobbyliga",
  },
  {
    key: "submitter_name",
    placeholder: "{{submitter_name}}",
    label: "Eintragender Spieler",
    description: "Name des Spielers, der das Ergebnis übermittelt hat",
    example: "Alexander Zverev",
  },
  {
    key: "opponent_name",
    placeholder: "{{opponent_name}}",
    label: "Gegner-Name",
    description: "Name des gegnerischen Spielers",
    example: "Jan-Lennard Struff",
  },
  {
    key: "result_score",
    placeholder: "{{result_score}}",
    label: "Match-Ergebnis",
    description: "Satzergebnis des Matches (z. B. 6:4, 7:5)",
    example: "6:4, 7:5",
  },
  {
    key: "match_date",
    placeholder: "{{match_date}}",
    label: "Match-Datum",
    description: "Datum, an dem das Match stattfand",
    example: "24.09.2026",
  },
  {
    key: "match_link",
    placeholder: "{{match_link}}",
    label: "Match-Link",
    description: "Direkter Link zur Spielansicht oder Bestätigung",
    example: "https://tennis-club.app/match/m-492",
  },
];

/**
 * Standard enterprise-grade mock templates.
 */
export const DEFAULT_EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  RESERVATION_CONFIRMED: {
    id: "RESERVATION_CONFIRMED",
    eventType: "RESERVATION_CONFIRMED",
    name: "Buchungsbestätigung",
    description: "Wird unmittelbar nach erfolgreicher Platzreservierung an das Mitglied versendet.",
    subject: "Buchung bestätigt: {{court_name}} am {{date}} ({{time}})",
    blocks: [
      {
        id: "b_rc_1",
        type: "text",
        columnSpan: "full",
        config: {
          content: "Hallo [Spieler-Name],\n\ndeine Platzbuchung wurde erfolgreich erfasst. Wir wünschen dir ein faires und spannendes Spiel auf unserer Tennisanlage!",
          fontFamily: "sans",
          fontSize: 16,
          lineHeight: 1.6,
          textAlign: "left",
          paddingY: 14,
          paddingX: 20,
          color: "#1e293b",
          backgroundColor: "transparent",
        },
      },
      {
        id: "b_rc_tile_1",
        type: "text",
        columnSpan: "half",
        config: {
          content: "🎾 Platz & Datum:\n• [Platz-Bezeichnung]\n• Datum: [Datum]",
          fontFamily: "sans",
          fontSize: 14,
          lineHeight: 1.6,
          textAlign: "left",
          paddingY: 14,
          paddingX: 16,
          color: "#0f172a",
          backgroundColor: "#f8fafc",
        },
      },
      {
        id: "b_rc_tile_2",
        type: "text",
        columnSpan: "half",
        config: {
          content: "⏱ Zeit & Buchungs-ID:\n• Zeit: [Uhrzeit]\n• ID: [Buchungs-Nummer]",
          fontFamily: "sans",
          fontSize: 14,
          lineHeight: 1.6,
          textAlign: "left",
          paddingY: 14,
          paddingX: 16,
          color: "#0f172a",
          backgroundColor: "#f8fafc",
        },
      },
      {
        id: "b_rc_3",
        type: "button",
        columnSpan: "full",
        config: {
          label: "Buchung verwalten oder stornieren",
          linkType: "dynamic",
          dynamicLinkKey: "cancellation_link",
          staticUrl: "https://tennis-club.app",
          align: "left",
          paddingY: 12,
          paddingX: 20,
          shape: "rounded",
          buttonColor: "#047857",
          textColor: "#ffffff",
          backgroundColor: "transparent",
        },
      },
      {
        id: "b_rc_4",
        type: "text",
        columnSpan: "full",
        config: {
          content: "Hinweis zur Platzpflege: Bitte ziehe den Platz nach Spielende bis an die Grundlinien ab und beachte eventuelle Bewässerungszeiten.",
          fontFamily: "sans",
          fontSize: 13,
          lineHeight: 1.5,
          textAlign: "left",
          paddingY: 10,
          paddingX: 20,
          color: "#64748b",
          backgroundColor: "transparent",
        },
      },
      {
        id: "b_rc_footer",
        type: "text",
        columnSpan: "full",
        config: {
          content: "[Vereinsname] • Online-Buchungssystem\nDiese Benachrichtigung wurde automatisch erzeugt.\n© 2026 [Vereinsname]. Alle Rechte vorbehalten.",
          fontFamily: "sans",
          fontSize: 11,
          lineHeight: 1.5,
          textAlign: "center",
          paddingY: 20,
          paddingX: 20,
          color: "#94a3b8",
          backgroundColor: "#f8fafc",
        },
      },
    ],
    bodyHtml: `
<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #1e293b;">
  Hallo <strong>{{user_name}}</strong>,
</p>

<p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
  deine Platzbuchung wurde erfolgreich in unserem Buchungssystem erfasst. Wir wünschen dir ein spannendes und faires Spiel!
</p>

<!-- Buchungs-Details Box -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
  <tr>
    <td style="padding: 16px 20px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #64748b; width: 35%;">Platz:</td>
          <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #0f172a;">{{court_name}}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Datum:</td>
          <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #0f172a;">{{date}}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Uhrzeit:</td>
          <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #0f172a;">{{time}}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Buchungs-ID:</td>
          <td style="padding: 6px 0; font-size: 13px; font-family: monospace; color: #475569;">{{booking_id}}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<!-- Action Button / Link -->
<p style="margin: 0 0 24px 0; text-align: center;">
  <a href="{{cancellation_link}}" style="display: inline-block; background-color: #047857; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600; letter-spacing: 0.2px;">
    Buchung verwalten oder stornieren
  </a>
</p>

<p style="margin: 0 0 8px 0; font-size: 13px; line-height: 20px; color: #64748b;">
  <em>Hinweis zur Platzpflege:</em> Bitte ziehe den Platz nach Spielende bis an die Grundlinien ab und beachte eventuelle Bewässerungszeiten.
</p>
    `.trim(),
    availableVariables: [
      "user_name",
      "court_name",
      "date",
      "time",
      "cancellation_link",
      "club_name",
      "booking_id",
    ],
  },

  RESERVATION_CANCELLED: {
    id: "RESERVATION_CANCELLED",
    eventType: "RESERVATION_CANCELLED",
    name: "Buchungsstornierung",
    description: "Wird versendet, wenn ein Mitglied oder Administrator eine Buchung storniert.",
    subject: "Buchung storniert: {{court_name}} am {{date}}",
    blocks: [
      {
        id: "b_can_1",
        type: "text",
        config: {
          content: "Hallo [Spieler-Name],\n\ndeine Reservierung für [Platz-Bezeichnung] am [Datum] ([Uhrzeit]) wurde storniert. Der Platz steht nun wieder anderen Vereinsmitgliedern zur Verfügung.",
          fontFamily: "sans",
          fontSize: 16,
          lineHeight: 1.6,
          textAlign: "left",
          paddingY: 10,
          paddingX: 0,
          color: "#1e293b",
        },
      },
      {
        id: "b_can_2",
        type: "button",
        config: {
          label: "Jetzt neuen Platz buchen",
          linkType: "static",
          dynamicLinkKey: "cancellation_link",
          staticUrl: "https://tennis-club.app",
          align: "left",
          paddingY: 12,
          paddingX: 24,
          shape: "rounded",
          buttonColor: "#0f172a",
          textColor: "#ffffff",
          backgroundColor: "transparent",
        },
      },
      {
        id: "b_can_3",
        type: "text",
        columnSpan: "full",
        config: {
          content: "Falls du zu einem anderen Zeitpunkt spielen möchtest, kannst du jederzeit einen neuen freien Zeitslot im Buchungsplan reservieren.",
          fontFamily: "sans",
          fontSize: 13,
          lineHeight: 1.5,
          textAlign: "left",
          paddingY: 10,
          paddingX: 20,
          color: "#64748b",
          backgroundColor: "transparent",
        },
      },
      {
        id: "b_can_footer",
        type: "text",
        columnSpan: "full",
        config: {
          content: "[Vereinsname] • Online-Buchungssystem\nDiese Benachrichtigung wurde automatisch erzeugt.\n© 2026 [Vereinsname]. Alle Rechte vorbehalten.",
          fontFamily: "sans",
          fontSize: 11,
          lineHeight: 1.5,
          textAlign: "center",
          paddingY: 20,
          paddingX: 20,
          color: "#94a3b8",
          backgroundColor: "#f8fafc",
        },
      },
    ],
    bodyHtml: `
<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #1e293b;">
  Hallo <strong>{{user_name}}</strong>,
</p>

<p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
  deine Reservierung wurde soeben erfolgreich storniert. Der Platz wurde wieder für alle Vereinsmitglieder freigegeben.
</p>

<!-- Stornierte Details Box -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px;">
  <tr>
    <td style="padding: 16px 20px;">
      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #e11d48; margin-bottom: 8px;">
        Stornierte Reservierung
      </div>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding: 4px 0; font-size: 13px; color: #881337; width: 35%;">Platz:</td>
          <td style="padding: 4px 0; font-size: 14px; font-weight: 600; color: #881337;">{{court_name}}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-size: 13px; color: #881337;">Datum & Zeit:</td>
          <td style="padding: 4px 0; font-size: 14px; font-weight: 600; color: #881337;">{{date}} ({{time}})</td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #475569;">
  Falls du zu einem anderen Zeitpunkt spielen möchtest, kannst du jederzeit einen neuen freien Zeitslot in der Buchungsübersicht reservieren.
</p>

<p style="margin: 0 0 16px 0; text-align: center;">
  <a href="{{cancellation_link}}" style="display: inline-block; background-color: #334155; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 13px; font-weight: 600;">
    Zurück zur Platzbelegung
  </a>
</p>
    `.trim(),
    availableVariables: [
      "user_name",
      "court_name",
      "date",
      "time",
      "cancellation_link",
      "club_name",
    ],
  },

  RESERVATION_MODIFIED: {
    id: "RESERVATION_MODIFIED",
    eventType: "RESERVATION_MODIFIED",
    name: "Buchungsänderung / Umbuchung",
    description: "Wird versendet, wenn ein Mitglied oder Administrator eine bestehende Buchung bearbeitet (z. B. Platz, Datum, Uhrzeit oder Mitspieler).",
    subject: "Buchung aktualisiert: {{court_name}} am {{date}} ({{time}})",
    blocks: [
      {
        id: "b_mod_1",
        type: "text",
        columnSpan: "full",
        config: {
          content: "Hallo [Spieler-Name],\n\ndeine Platzreservierung wurde soeben erfolgreich bearbeitet bzw. umgebucht. Hier findest du deine aktualisierten Spieldetails:",
          fontFamily: "sans",
          fontSize: 16,
          lineHeight: 1.6,
          textAlign: "left",
          paddingY: 14,
          paddingX: 20,
          color: "#1e293b",
          backgroundColor: "transparent",
        },
      },
      {
        id: "b_mod_tile_new",
        type: "text",
        columnSpan: "half",
        config: {
          content: "✅ Neuer Spieltermin:\n• Platz: [Platz-Bezeichnung]\n• Datum: [Datum]\n• Zeit: [Uhrzeit]",
          fontFamily: "sans",
          fontSize: 14,
          lineHeight: 1.6,
          textAlign: "left",
          paddingY: 14,
          paddingX: 16,
          color: "#14532d",
          backgroundColor: "#f0fdf4",
        },
      },
      {
        id: "b_mod_tile_old",
        type: "text",
        columnSpan: "half",
        config: {
          content: "ℹ️ Vorherige Buchungsdaten:\n• Platz: [Vorheriger Platz]\n• Datum: [Vorheriges Datum]\n• Zeit: [Vorherige Uhrzeit]",
          fontFamily: "sans",
          fontSize: 14,
          lineHeight: 1.6,
          textAlign: "left",
          paddingY: 14,
          paddingX: 16,
          color: "#64748b",
          backgroundColor: "#f8fafc",
        },
      },
      {
        id: "b_mod_3",
        type: "button",
        columnSpan: "full",
        config: {
          label: "Aktualisierte Buchung aufrufen",
          linkType: "dynamic",
          dynamicLinkKey: "cancellation_link",
          staticUrl: "https://tennis-club.app",
          align: "left",
          paddingY: 12,
          paddingX: 20,
          shape: "rounded",
          buttonColor: "#047857",
          textColor: "#ffffff",
          backgroundColor: "transparent",
        },
      },
      {
        id: "b_mod_4",
        type: "text",
        columnSpan: "full",
        config: {
          content: "Falls du diese Änderung nicht selbst veranlasst hast oder Fragen hast, wende dich bitte an die Platzverwaltung deines Vereins.",
          fontFamily: "sans",
          fontSize: 13,
          lineHeight: 1.5,
          textAlign: "left",
          paddingY: 10,
          paddingX: 20,
          color: "#64748b",
          backgroundColor: "transparent",
        },
      },
      {
        id: "b_mod_footer",
        type: "text",
        columnSpan: "full",
        config: {
          content: "[Vereinsname] • Online-Buchungssystem\nDiese Benachrichtigung wurde automatisch erzeugt.\n© 2026 [Vereinsname]. Alle Rechte vorbehalten.",
          fontFamily: "sans",
          fontSize: 11,
          lineHeight: 1.5,
          textAlign: "center",
          paddingY: 20,
          paddingX: 20,
          color: "#94a3b8",
          backgroundColor: "#f8fafc",
        },
      },
    ],
    bodyHtml: `
<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #1e293b;">
  Hallo <strong>{{user_name}}</strong>,
</p>

<p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
  deine Platzreservierung wurde soeben erfolgreich bearbeitet bzw. umgebucht. Hier findest du deine aktualisierten Spieldetails:
</p>

<!-- Neue Buchungs-Details Box -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; border-radius: 8px;">
  <tr>
    <td style="padding: 16px 20px;">
      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #166534; margin-bottom: 8px;">
        Aktualisierter Termin (Neu)
      </div>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding: 5px 0; font-size: 13px; color: #166534; width: 35%;">Platz:</td>
          <td style="padding: 5px 0; font-size: 14px; font-weight: 700; color: #14532d;">{{court_name}}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; font-size: 13px; color: #166534;">Datum:</td>
          <td style="padding: 5px 0; font-size: 14px; font-weight: 700; color: #14532d;">{{date}}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; font-size: 13px; color: #166534;">Uhrzeit:</td>
          <td style="padding: 5px 0; font-size: 14px; font-weight: 700; color: #14532d;">{{time}}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; font-size: 13px; color: #166534;">Mitspieler:</td>
          <td style="padding: 5px 0; font-size: 13px; color: #14532d;">{{players}}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; font-size: 13px; color: #166534;">Buchungs-ID:</td>
          <td style="padding: 5px 0; font-size: 13px; font-family: monospace; color: #15803d;">{{booking_id}}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<!-- Vorherige Buchungs-Details Box (Vergleich) -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
  <tr>
    <td style="padding: 12px 18px;">
      <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 6px;">
        Vorherige Spieldaten (Ersetzt)
      </div>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding: 3px 0; font-size: 12px; color: #94a3b8; width: 35%;">Vorheriger Platz:</td>
          <td style="padding: 3px 0; font-size: 12px; color: #64748b;">{{old_court_name}}</td>
        </tr>
        <tr>
          <td style="padding: 3px 0; font-size: 12px; color: #94a3b8;">Vorheriges Datum:</td>
          <td style="padding: 3px 0; font-size: 12px; color: #64748b;">{{old_date}}</td>
        </tr>
        <tr>
          <td style="padding: 3px 0; font-size: 12px; color: #94a3b8;">Vorherige Zeit:</td>
          <td style="padding: 3px 0; font-size: 12px; color: #64748b;">{{old_time}}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<p style="margin: 0 0 24px 0; text-align: center;">
  <a href="{{cancellation_link}}" style="display: inline-block; background-color: #047857; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">
    Buchungsübersicht öffnen
  </a>
</p>

<p style="margin: 0; font-size: 12px; line-height: 18px; color: #94a3b8;">
  Falls du diese Änderung nicht selbst veranlasst hast oder Fragen hast, wende dich bitte an die Platzverwaltung deines Vereins.
</p>
    `.trim(),
    availableVariables: [
      "user_name",
      "court_name",
      "date",
      "time",
      "old_court_name",
      "old_date",
      "old_time",
      "players",
      "cancellation_link",
      "club_name",
      "booking_id",
    ],
  },

  HOBBYLIGA_NEW_POST: {
    id: "HOBBYLIGA_NEW_POST",
    eventType: "HOBBYLIGA_NEW_POST",
    name: "Hobbyliga: Neuer Beitrag",
    description: "Broadcast-Benachrichtigung an alle Liga-Teilnehmer, sobald ein neuer Beitrag auf der Pinnwand erscheint (außer an den Verfasser selbst).",
    subject: "Neuer Beitrag in der {{league_name}}: „{{post_title}}“",
    blocks: [
      {
        id: "b_post_1",
        type: "text",
        config: {
          content: "Hallo [Spieler-Name],\n\nes gibt einen neuen Beitrag an der Liga-Pinnwand in deiner [Liga-Name] von [Verfasser-Name]:",
          fontFamily: "sans",
          fontSize: 16,
          lineHeight: 1.6,
          textAlign: "left",
          paddingY: 10,
          paddingX: 0,
          color: "#1e293b",
        },
      },
      {
        id: "b_post_2",
        type: "text",
        config: {
          content: "»[Beitrags-Titel]«\n\n[Beitrags-Text]",
          fontFamily: "sans",
          fontSize: 15,
          lineHeight: 1.6,
          textAlign: "left",
          paddingY: 14,
          paddingX: 0,
          color: "#0f172a",
        },
      },
      {
        id: "b_post_3",
        type: "button",
        config: {
          label: "Zur Hobbyliga & Pinnwand",
          linkType: "dynamic",
          dynamicLinkKey: "league_link",
          staticUrl: "https://tennis-club.app/hobbyliga",
          align: "left",
          paddingY: 12,
          paddingX: 24,
          shape: "rounded",
          buttonColor: "#0284c7",
          textColor: "#ffffff",
          backgroundColor: "transparent",
        },
      },
      {
        id: "b_post_4",
        type: "text",
        columnSpan: "full",
        config: {
          content: "Du erhältst diese Benachrichtigung als aktiver Teilnehmer der [Liga-Name]. Du kannst deine Benachrichtigungs-Einstellungen jederzeit im Profil anpassen.",
          fontFamily: "sans",
          fontSize: 12,
          lineHeight: 1.5,
          textAlign: "left",
          paddingY: 10,
          paddingX: 20,
          color: "#94a3b8",
          backgroundColor: "transparent",
        },
      },
      {
        id: "b_post_footer",
        type: "text",
        columnSpan: "full",
        config: {
          content: "[Vereinsname] • Online-Buchungssystem\nDiese Benachrichtigung wurde automatisch erzeugt.\n© 2026 [Vereinsname]. Alle Rechte vorbehalten.",
          fontFamily: "sans",
          fontSize: 11,
          lineHeight: 1.5,
          textAlign: "center",
          paddingY: 20,
          paddingX: 20,
          color: "#94a3b8",
          backgroundColor: "#f8fafc",
        },
      },
    ],
    bodyHtml: `
<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #1e293b;">
  Hallo <strong>{{user_name}}</strong>,
</p>

<p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
  in deiner <strong>{{league_name}}</strong> hat <strong>{{author_name}}</strong> einen neuen Beitrag auf der Liga-Pinnwand veröffentlicht:
</p>

<!-- Pinnwand-Beitrag Vorschau-Box -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #047857; border-radius: 6px;">
  <tr>
    <td style="padding: 18px 20px;">
      <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">
        {{post_title}}
      </div>
      <div style="font-size: 14px; line-height: 22px; color: #334155; font-style: italic; margin-bottom: 12px;">
        „{{post_content}}“
      </div>
      <div style="font-size: 12px; color: #64748b;">
        Veröffentlicht von <strong>{{author_name}}</strong>
      </div>
    </td>
  </tr>
</table>

<!-- Button zur Liga -->
<p style="margin: 0 0 24px 0; text-align: center;">
  <a href="{{league_link}}" style="display: inline-block; background-color: #047857; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">
    Beitrag in der Hobbyliga öffnen & antworten
  </a>
</p>

<p style="margin: 0; font-size: 12px; line-height: 18px; color: #94a3b8;">
  Du erhältst diese Benachrichtigung als aktiver Teilnehmer der {{league_name}}. Du kannst deine Benachrichtigungs-Einstellungen jederzeit im Profil anpassen.
</p>
    `.trim(),
    availableVariables: [
      "user_name",
      "league_name",
      "author_name",
      "post_title",
      "post_content",
      "league_link",
      "club_name",
    ],
  },

  MATCH_RESULT_SUBMITTED: {
    id: "MATCH_RESULT_SUBMITTED",
    eventType: "MATCH_RESULT_SUBMITTED",
    name: "Match-Ergebnis eingetragen",
    description: "Geht strikt nur an den gegnerischen Spieler, nachdem ein Match-Ergebnis eingetragen wurde.",
    subject: "Spielergebnis eingetragen: {{submitter_name}} vs. {{opponent_name}} ({{result_score}})",
    blocks: [
      {
        id: "b_res_1",
        type: "text",
        columnSpan: "full",
        config: {
          content: "Hallo [Gegner-Name],\n\ndein Spielpartner [Eintragender Spieler] hat das Ergebnis eures Matches in der [Liga-Name] eingetragen:",
          fontFamily: "sans",
          fontSize: 16,
          lineHeight: 1.6,
          textAlign: "left",
          paddingY: 14,
          paddingX: 20,
          color: "#1e293b",
          backgroundColor: "transparent",
        },
      },
      {
        id: "b_res_tile_score",
        type: "text",
        columnSpan: "half",
        config: {
          content: "🏆 Spielergebnis:\n• Satz & Spiele: [Match-Ergebnis]\n• Spieldatum: [Match-Datum]",
          fontFamily: "sans",
          fontSize: 14,
          lineHeight: 1.6,
          textAlign: "left",
          paddingY: 14,
          paddingX: 16,
          color: "#14532d",
          backgroundColor: "#f0fdf4",
        },
      },
      {
        id: "b_res_tile_players",
        type: "text",
        columnSpan: "half",
        config: {
          content: "👥 Match-Paarung:\n• [Eintragender Spieler]\nvs. [Gegner-Name]",
          fontFamily: "sans",
          fontSize: 14,
          lineHeight: 1.6,
          textAlign: "left",
          paddingY: 14,
          paddingX: 16,
          color: "#0f172a",
          backgroundColor: "#f8fafc",
        },
      },
      {
        id: "b_res_3",
        type: "button",
        columnSpan: "full",
        config: {
          label: "Tabelle & Spielbericht aufrufen",
          linkType: "dynamic",
          dynamicLinkKey: "match_link",
          staticUrl: "https://tennis-club.app/match",
          align: "left",
          paddingY: 12,
          paddingX: 20,
          shape: "rounded",
          buttonColor: "#15803d",
          textColor: "#ffffff",
          backgroundColor: "transparent",
        },
      },
      {
        id: "b_res_4",
        type: "text",
        columnSpan: "full",
        config: {
          content: "Hinweis: Sollte das Ergebnis nicht mit deinen Aufzeichnungen übereinstimmen, wende dich bitte an deinen Spielpartner oder die Spielleitung.",
          fontFamily: "sans",
          fontSize: 12,
          lineHeight: 1.5,
          textAlign: "left",
          paddingY: 10,
          paddingX: 20,
          color: "#64748b",
          backgroundColor: "transparent",
        },
      },
      {
        id: "b_res_footer",
        type: "text",
        columnSpan: "full",
        config: {
          content: "[Vereinsname] • Online-Buchungssystem\nDiese Benachrichtigung wurde automatisch erzeugt.\n© 2026 [Vereinsname]. Alle Rechte vorbehalten.",
          fontFamily: "sans",
          fontSize: 11,
          lineHeight: 1.5,
          textAlign: "center",
          paddingY: 20,
          paddingX: 20,
          color: "#94a3b8",
          backgroundColor: "#f8fafc",
        },
      },
    ],
    bodyHtml: `
<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #1e293b;">
  Hallo <strong>{{opponent_name}}</strong>,
</p>

<p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
  dein Spielpartner <strong>{{submitter_name}}</strong> hat soeben das Ergebnis eures Matches in der <strong>{{league_name}}</strong> eingetragen.
</p>

<!-- Ergebnis-Box -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
  <tr>
    <td style="padding: 20px; text-align: center;">
      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #166534; letter-spacing: 0.5px; margin-bottom: 6px;">
        Offizielles Endergebnis
      </div>
      <div style="font-size: 24px; font-weight: 800; color: #14532d; letter-spacing: 1px; margin-bottom: 8px;">
        {{result_score}}
      </div>
      <div style="font-size: 13px; color: #15803d;">
        Begegnung: <strong>{{submitter_name}}</strong> vs. <strong>{{opponent_name}}</strong>
      </div>
      <div style="font-size: 12px; color: #166534; margin-top: 4px;">
        Spieldatum: {{match_date}}
      </div>
    </td>
  </tr>
</table>

<!-- Button zur Tabelle / Match -->
<p style="margin: 0 0 20px 0; text-align: center;">
  <a href="{{match_link}}" style="display: inline-block; background-color: #15803d; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">
    Tabelle & Spielbericht aufrufen
  </a>
</p>

<p style="margin: 0; font-size: 12px; line-height: 18px; color: #64748b;">
  <em>Hinweis:</em> Sollte das Ergebnis nicht mit deinen Aufzeichnungen übereinstimmen, wende dich bitte an deinen Spielpartner oder die Spielleitung.
</p>
    `.trim(),
    availableVariables: [
      "user_name",
      "opponent_name",
      "submitter_name",
      "result_score",
      "league_name",
      "match_date",
      "match_link",
      "club_name",
    ],
  },
};

/**
 * Realistic default payload used for template preview and test mails.
 */
export const DEFAULT_MOCK_PAYLOAD: Record<string, string> = {
  user_name: "Alexander Becker",
  court_name: "Platz 1 (Center Court)",
  date: "18. Juli 2026",
  time: "18:00 - 19:00 Uhr",
  old_court_name: "Platz 2",
  old_date: "17. Juli 2026",
  old_time: "17:00 - 18:00 Uhr",
  players: "Alexander Becker, Michael Stich",
  cancellation_link: "https://tennis-club.app/meine-buchungen?cancel=BK-9841",
  club_name: "DJK / SV Tennisverein e.V.",
  booking_id: "BK-2026-9841",
  league_name: "Hobbyliga Herren A",
  author_name: "Boris Becker",
  post_title: "Spielpartner für Samstag gesucht",
  post_content: "Hallo zusammen, wer hat Lust am kommenden Samstag um 10:00 Uhr auf Platz 2 eine Runde zu spielen? Bitte kurz Bescheid geben.",
  league_link: "https://tennis-club.app/hobbyliga",
  submitter_name: "Alexander Zverev",
  opponent_name: "Jan-Lennard Struff",
  result_score: "6:4, 7:5",
  match_date: "25.09.2026",
  match_link: "https://tennis-club.app/match/m-492",
};
