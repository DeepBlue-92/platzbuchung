import { EmailTemplate, NotificationEventKey, SendMailResult } from "../types/notifications";
import { DEFAULT_EMAIL_TEMPLATES } from "./notificationTemplates";
import { renderEmail, RenderResult } from "./templateEngine";
import { getDynamicTestPayload } from "./blockTemplateCompiler";

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
  payload?: Record<string, any>,
  clubName?: string
): RenderResult {
  return renderEmail({
    subjectTemplate: template.subject,
    bodyTemplate: template.bodyHtml,
    blocks: template.blocks,
    globalSettings: template.globalSettings,
    payload: payload || getDynamicTestPayload(clubName),
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
  const { eventKey, recipientEmail, payload, customTemplate, clubName } = options;
  const effectivePayload = payload || getDynamicTestPayload(clubName);

  try {
    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventKey,
        recipientEmail,
        payload: effectivePayload,
        customTemplate,
        clubName,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        status: "failed",
        message: errorData.message || `Serverfehler: Status ${response.status}`,
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
 * Notifies booking owner and partner players of an edited / rebooked reservation.
 */
export async function notifyBookingModifiedApi(options: {
  bookingId: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  recipientEmail?: string;
  courtName: string;
  date: string;
  time: string;
  oldCourtName?: string;
  oldDate?: string;
  oldTime?: string;
  players?: string[];
  cancellationLink?: string;
  comment?: string;
  vereinsId?: string;
  clubName?: string;
  users?: Record<string, any>;
}): Promise<any> {
  try {
    const response = await fetch("/api/notifications/booking-modified", {
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
    console.warn("API booking-modified notify failed, executing client-side dispatcher fallback:", err);
    const { notifyBookingModified } = await import("./notificationDispatcher");
    return await notifyBookingModified(
      {
        bookingId: options.bookingId,
        userId: options.userId,
        userName: options.userName,
        userEmail: options.userEmail,
        recipientEmail: options.recipientEmail,
        courtName: options.courtName,
        date: options.date,
        time: options.time,
        oldCourtName: options.oldCourtName,
        oldDate: options.oldDate,
        oldTime: options.oldTime,
        players: options.players,
        cancellationLink: options.cancellationLink,
        comment: options.comment,
        vereinsId: options.vereinsId,
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
 * Sends initial account activation email with secure one-time token to a user.
 */
export async function sendUserActivationApi(
  userId: string,
  options: { vereinsId?: string; clubName?: string; user?: any } = {}
): Promise<{ success: boolean; message: string; sentAt?: string; mailResult?: any; error?: string }> {
  try {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/send-activation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vereinsId: options.vereinsId || "sv-neuhausen",
        clubName: options.clubName || "Tennis-Club e.V.",
        user: options.user,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        message: data.message || `Fehler beim Versenden der Aktivierungs-E-Mail (Status ${res.status}).`,
        error: data.error,
      };
    }

    return data;
  } catch (err: any) {
    console.error("sendUserActivationApi error:", err);
    return {
      success: false,
      message: err.message || "Netzwerkfehler beim Versenden der Aktivierungs-E-Mail.",
      error: "NETWORK_ERROR",
    };
  }
}

/**
 * Sends password reset email with secure one-time token to an active user.
 */
export async function sendUserPasswordResetApi(
  userId: string,
  options: { vereinsId?: string; clubName?: string; user?: any } = {}
): Promise<{ success: boolean; message: string; sentAt?: string; mailResult?: any; error?: string }> {
  try {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/send-password-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vereinsId: options.vereinsId || "sv-neuhausen",
        clubName: options.clubName || "Tennis-Club e.V.",
        user: options.user,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        message: data.message || `Fehler beim Versenden der Passwort-Reset-E-Mail (Status ${res.status}).`,
        error: data.error,
      };
    }

    return data;
  } catch (err: any) {
    console.error("sendUserPasswordResetApi error:", err);
    return {
      success: false,
      message: err.message || "Netzwerkfehler beim Versenden der Passwort-Reset-E-Mail.",
      error: "NETWORK_ERROR",
    };
  }
}

/**
 * Bulk sends activation emails to multiple selected users.
 */
export async function bulkSendUserActivationApi(
  userIds: string[],
  options: { vereinsId?: string; clubName?: string; users?: Record<string, any> } = {}
): Promise<{
  success: boolean;
  sentCount: number;
  failedCount: number;
  skippedUsers: any[];
  updatedTimestamps?: Record<string, string>;
  message: string;
}> {
  try {
    const res = await fetch("/api/admin/users/bulk-send-activation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userIds,
        vereinsId: options.vereinsId || "sv-neuhausen",
        clubName: options.clubName || "Tennis-Club e.V.",
        users: options.users,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        sentCount: data.sentCount || 0,
        failedCount: data.failedCount || userIds.length,
        skippedUsers: data.skippedUsers || [],
        message: data.message || `Fehler beim Massenversand (Status ${res.status}).`,
      };
    }

    return data;
  } catch (err: any) {
    console.error("bulkSendUserActivationApi error:", err);
    return {
      success: false,
      sentCount: 0,
      failedCount: userIds.length,
      skippedUsers: [],
      message: err.message || "Netzwerkfehler beim Massenversand der Aktivierungs-Mails.",
    };
  }
}


