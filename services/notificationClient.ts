import { EmailTemplate, NotificationEventKey, SendMailResult } from "../types/notifications";
import { DEFAULT_EMAIL_TEMPLATES, DEFAULT_MOCK_PAYLOAD } from "./notificationTemplates";
import { renderEmail, RenderResult } from "./templateEngine";

const LOCAL_STORAGE_KEY_TEMPLATES = "tennis_app_custom_email_templates";

/**
 * Loads templates from localStorage / defaults.
 */
export function loadClientEmailTemplates(): Record<string, EmailTemplate> {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_TEMPLATES);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_EMAIL_TEMPLATES,
        ...parsed,
      };
    }
  } catch (err) {
    console.warn("Could not read custom templates from localStorage:", err);
  }
  return { ...DEFAULT_EMAIL_TEMPLATES };
}

/**
 * Saves modified templates to localStorage.
 */
export function saveClientEmailTemplates(
  templates: Record<string, EmailTemplate>
): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_TEMPLATES, JSON.stringify(templates));
  } catch (err) {
    console.error("Could not save custom templates to localStorage:", err);
  }
}

/**
 * Renders the live email preview client-side in real-time.
 */
export function getLiveEmailPreview(
  template: EmailTemplate,
  payload: Record<string, any> = DEFAULT_MOCK_PAYLOAD,
  clubName?: string
): RenderResult {
  return renderEmail({
    subjectTemplate: template.subject,
    bodyTemplate: template.bodyHtml,
    payload,
    wrapperOptions: {
      clubName: clubName || "Tennis-Club e.V.",
    },
  });
}

/**
 * Calls backend API to send real/simulated notification mail via Resend.
 */
export async function sendTestEmailApi(options: {
  eventKey: NotificationEventKey;
  recipientEmail: string;
  payload?: Record<string, any>;
  customTemplate?: Partial<EmailTemplate>;
  clubName?: string;
}): Promise<SendMailResult> {
  const { eventKey, recipientEmail, payload = DEFAULT_MOCK_PAYLOAD, customTemplate, clubName } = options;

  try {
    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventKey,
        recipientEmail,
        payload,
        customTemplate,
        clubName,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        status: "failed",
        message: errorData.message || `Server-Fehler: Status ${response.status}`,
        error: errorData.error || "HTTP_ERROR",
      };
    }

    return await response.json();
  } catch (err: any) {
    console.warn("Backend /api/send-email unreachable, performing client-side simulation:", err);
    // Client-side fallback if server is unreachable
    const preview = getLiveEmailPreview(
      customTemplate as EmailTemplate || DEFAULT_EMAIL_TEMPLATES[eventKey],
      payload,
      clubName
    );

    return {
      success: true,
      simulated: true,
      status: "simulated",
      message: `Simulationsmodus (Client): Test-E-Mail erfolgreich für ${recipientEmail} generiert.`,
      renderedSubject: preview.renderedSubject,
      renderedHtml: preview.fullHtml,
    };
  }
}

/**
 * Bulk updates notification settings for multiple users.
 */
export async function bulkUpdateNotificationsApi(options: {
  userIds: string[];
  eventKey: NotificationEventKey;
  enabled: boolean;
  vereinsId?: string;
}): Promise<{ success: boolean; updatedCount: number; message?: string }> {
  try {
    const response = await fetch("/api/notifications/bulk-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Status ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    console.warn("API bulk update failed, executing client-side Firestore fallback:", err);
    // Dynamic import to avoid circular dependency
    const { bulkUpdateUserNotificationSettings } = await import("./db");
    return await bulkUpdateUserNotificationSettings(
      options.vereinsId || "sv-neuhausen",
      options.userIds,
      options.eventKey,
      options.enabled
    );
  }
}

/**
 * Broadcasts a new post in Hobbyliga.
 */
export async function broadcastHobbyligaPostApi(options: {
  authorId: string;
  authorName: string;
  leagueId?: string;
  leagueName?: string;
  postTitle: string;
  postContent: string;
  vereinsId?: string;
  clubName?: string;
  users?: Record<string, any>;
}): Promise<any> {
  try {
    const response = await fetch("/api/notifications/broadcast-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Status ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    console.warn("API broadcast failed, executing client-side dispatcher fallback:", err);
    const { broadcastHobbyligaNewPost } = await import("./notificationDispatcher");
    return await broadcastHobbyligaNewPost(
      {
        authorId: options.authorId,
        authorName: options.authorName,
        leagueId: options.leagueId,
        leagueName: options.leagueName,
        postTitle: options.postTitle,
        postContent: options.postContent,
        vereinsId: options.vereinsId,
      },
      options.users || {},
      options.clubName
    );
  }
}

/**
 * Notifies opponent of a submitted match result.
 */
export async function notifyMatchResultApi(options: {
  submitterId: string;
  submitterName: string;
  opponentId: string;
  opponentName?: string;
  resultScore: string;
  matchDate?: string;
  leagueName?: string;
  courtName?: string;
  clubName?: string;
  users?: Record<string, any>;
}): Promise<any> {
  try {
    const response = await fetch("/api/notifications/match-result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Status ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    console.warn("API match-result notify failed, executing client-side dispatcher fallback:", err);
    const { notifyMatchResultSubmitted } = await import("./notificationDispatcher");
    return await notifyMatchResultSubmitted(
      {
        submitterId: options.submitterId,
        submitterName: options.submitterName,
        opponentId: options.opponentId,
        opponentName: options.opponentName,
        resultScore: options.resultScore,
        matchDate: options.matchDate,
        leagueName: options.leagueName,
        courtName: options.courtName,
      },
      options.users || {},
      options.clubName
    );
  }
}

/**
 * Loads default notification settings for new users.
 */
export async function loadNotificationDefaultsApi(
  vereinsId = "sv-neuhausen"
): Promise<any> {
  try {
    const { getClubDefaultNotificationSettings } = await import("./db");
    const defaults = await getClubDefaultNotificationSettings(vereinsId);
    if (defaults) return defaults;
  } catch (clientErr) {
    console.warn("Direct Firestore read failed, trying server endpoint:", clientErr);
  }

  try {
    const res = await fetch(`/api/notifications/defaults?vereinsId=${encodeURIComponent(vereinsId)}`);
    if (res.ok) {
      const data = await res.json();
      return data.defaults;
    }
  } catch (err) {
    console.warn("Could not load notification defaults from API:", err);
  }
  return null;
}

/**
 * Saves default notification settings for new users.
 */
export async function saveNotificationDefaultsApi(
  vereinsId: string,
  defaults: any
): Promise<boolean> {
  try {
    const { updateClubDefaultNotificationSettings } = await import("./db");
    await updateClubDefaultNotificationSettings(vereinsId, defaults);
    return true;
  } catch (clientErr) {
    console.warn("Direct Firestore update failed, trying server endpoint:", clientErr);
    try {
      const res = await fetch("/api/notifications/defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vereinsId, defaults }),
      });
      return res.ok;
    } catch (err) {
      console.warn("Could not save notification defaults via API:", err);
      return false;
    }
  }
}

