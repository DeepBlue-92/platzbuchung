import { Resend } from "resend";
import { DEFAULT_EMAIL_TEMPLATES } from "./notificationTemplates";
import { renderEmail } from "./templateEngine";
import {
  NotificationEventKey,
  SendMailOptions,
  SendMailResult,
  EmailTemplate,
} from "../types/notifications";

/**
 * Global memory store for customized templates (can also be saved to Firestore).
 */
const customTemplatesStore: Record<string, EmailTemplate> = {};

export function getTemplate(eventKey: NotificationEventKey): EmailTemplate {
  return customTemplatesStore[eventKey] || DEFAULT_EMAIL_TEMPLATES[eventKey] || {
    id: eventKey,
    name: eventKey,
    description: "Benachrichtigungsvorlage",
    subject: "Benachrichtigung zu deiner Platzreservierung",
    bodyHtml: "<p>Hallo {{user_name}},</p><p>es gibt ein Update zu deiner Buchung: {{court_name}} am {{date}}.</p>",
    availableVariables: ["user_name", "court_name", "date", "time", "cancellation_link"],
  };
}

export function saveCustomTemplate(template: EmailTemplate): void {
  customTemplatesStore[template.id] = {
    ...template,
    updatedAt: new Date().toISOString(),
  };
}

export function getAllTemplates(): Record<string, EmailTemplate> {
  return {
    ...DEFAULT_EMAIL_TEMPLATES,
    ...customTemplatesStore,
  };
}

/**
 * Initializes the Resend client if an API key is available.
 */
function getResendClient(): Resend | null {
  const apiKey =
    process.env.RESEND_API_KEY ||
    (typeof process !== "undefined" && process.env?.VITE_RESEND_API_KEY);

  if (!apiKey || apiKey === "re_test_key" || apiKey.trim() === "") {
    return null;
  }

  try {
    return new Resend(apiKey);
  } catch (err) {
    console.error("Failed to initialize Resend client:", err);
    return null;
  }
}

/**
 * Core notification email sender function.
 * Loads the template, renders with Handlebars, embeds in wrapper, and dispatches via Resend.
 */
export async function sendNotificationMail(
  options: SendMailOptions
): Promise<SendMailResult> {
  const { eventKey, recipientEmail, payload, customTemplate, clubName, clubLogoUrl } = options;

  if (!recipientEmail || !recipientEmail.includes("@")) {
    return {
      success: false,
      status: "failed",
      message: "Ungültige Empfänger-E-Mail-Adresse angegeben.",
      error: "INVALID_EMAIL",
    };
  }

  // 1. Resolve template
  const template = customTemplate
    ? { ...getTemplate(eventKey), ...customTemplate }
    : getTemplate(eventKey);

  // 2. Render content and wrapper
  const { renderedSubject, renderedBody, fullHtml } = renderEmail({
    subjectTemplate: template.subject,
    bodyTemplate: template.bodyHtml,
    payload: {
      ...payload,
      club_name: clubName || payload.club_name || "Tennis-Club e.V.",
    },
    wrapperOptions: {
      clubName: clubName || "Tennis-Club e.V.",
      logoUrl: clubLogoUrl,
    },
  });

  // 3. Dispatch via Resend or Fallback Simulation
  const resend = getResendClient();

  if (!resend) {
    console.log(`[Email Simulation] Event: ${eventKey} -> Recipient: ${recipientEmail}`);
    console.log(`[Email Simulation] Subject: ${renderedSubject}`);
    console.log(`[Email Simulation] Note: Set RESEND_API_KEY to send real emails.`);

    return {
      success: true,
      simulated: true,
      status: "simulated",
      messageId: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      message: `Simulationsmodus: E-Mail erfolgreich generiert und protokolliert. (Hinweis: Für den echten Postausgang kann ein RESEND_API_KEY in den Umgebungsvariablen hinterlegt werden).`,
      renderedSubject,
      renderedHtml: fullHtml,
    };
  }

  try {
    const fromAddress =
      process.env.RESEND_FROM_EMAIL ||
      `${clubName || "Tennis-Club"} <onboarding@resend.dev>`;

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [recipientEmail],
      subject: renderedSubject,
      html: fullHtml,
    });

    if (error) {
      console.error("Resend API error:", error);
      return {
        success: false,
        status: "failed",
        message: `Fehler beim Resend-Versand: ${error.message || "Unbekannter API-Fehler"}`,
        error: error.name || "RESEND_ERROR",
        renderedSubject,
        renderedHtml: fullHtml,
      };
    }

    return {
      success: true,
      status: "sent",
      messageId: data?.id,
      message: `E-Mail erfolgreich via Resend an ${recipientEmail} versendet! (ID: ${data?.id})`,
      renderedSubject,
      renderedHtml: fullHtml,
    };
  } catch (err: any) {
    console.error("Failed to execute resend.emails.send:", err);
    return {
      success: false,
      status: "failed",
      message: `Ausnahmefehler beim E-Mail-Versand: ${err.message || String(err)}`,
      error: err.message || "EXCEPTION",
      renderedSubject,
      renderedHtml: fullHtml,
    };
  }
}
