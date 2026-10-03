import { User } from "../types";
import {
  HobbyligaBroadcastPayload,
  MatchResultNotificationPayload,
  BookingModifiedNotificationPayload,
  SendMailResult,
} from "../types/notifications";
import { sendNotificationMail } from "./resendService";
import { isEventGloballyActive, isGlobalEmailPaused } from "./emailTemplateStorage";

export interface BroadcastResult {
  success: boolean;
  totalCandidates: number;
  sentCount: number;
  skippedAuthor: number;
  skippedOptOut: number;
  skippedNoEmail: number;
  recipients: Array<{
    id: string;
    name: string;
    email: string;
    status: string;
    simulated?: boolean;
    error?: string;
  }>;
}

export interface MatchResultNotificationResult {
  success: boolean;
  sent: boolean;
  opponentId: string;
  opponentName?: string;
  opponentEmail?: string;
  reason?: string;
  result?: SendMailResult;
}

/**
 * Event 'HOBBYLIGA_NEW_POST':
 * Broadcast-Benachrichtigung an alle aktiven Hobbyligateilnehmer (außer an den Verfasser selbst).
 * Respektiert individuelle Opt-out-Einstellungen (HOBBYLIGA_NEW_POST: false).
 */
export async function broadcastHobbyligaNewPost(
  payload: HobbyligaBroadcastPayload,
  users: Record<string, User> | User[],
  clubName = "Tennis-Club e.V."
): Promise<BroadcastResult> {
  // Master-Kill-Switch check
  const vereinsId = payload.vereinsId || "sv-neuhausen";
  if (await isGlobalEmailPaused(vereinsId)) {
    console.info(`[NotificationDispatcher] E-Mail-Versand ist im Verein '${vereinsId}' global pausiert (Not-Aus).`);
    return {
      success: true,
      totalCandidates: 0,
      sentCount: 0,
      skippedAuthor: 0,
      skippedOptOut: 0,
      skippedNoEmail: 0,
      recipients: [],
    };
  }

  const isGloballyActive = await isEventGloballyActive(vereinsId, "HOBBYLIGA_NEW_POST");
  if (!isGloballyActive) {
    console.info(`[NotificationDispatcher] 'HOBBYLIGA_NEW_POST' ist im Verein '${vereinsId}' global deaktiviert. Keine E-Mails versendet.`);
    return {
      success: true,
      totalCandidates: 0,
      sentCount: 0,
      skippedAuthor: 0,
      skippedOptOut: 0,
      skippedNoEmail: 0,
      recipients: [],
    };
  }

  const usersList: User[] = Array.isArray(users) ? users : Object.values(users);

  let skippedAuthor = 0;
  let skippedOptOut = 0;
  let skippedNoEmail = 0;
  const eligibleRecipients: User[] = [];

  for (const user of usersList) {
    const userId = user.id || user.name;

    // 1. Exclude the author themselves
    if (userId === payload.authorId || user.email === payload.authorId) {
      skippedAuthor++;
      continue;
    }

    // 2. Filter: Must be in Hobby League
    const isHobbyLeague =
      user.hobbyLeagueOptIn === true ||
      (user.hobbyLeagueOptIn as any) === "true" ||
      (payload.leagueId && user.leagueId === payload.leagueId);

    if (!isHobbyLeague) {
      continue;
    }

    // 3. Filter: Check user notification settings (default is true if undefined)
    const settings = user.notification_settings || user.notificationSettings;
    const isEnabled = settings?.HOBBYLIGA_NEW_POST !== false;
    if (!isEnabled) {
      skippedOptOut++;
      continue;
    }

    // 4. Must have a valid email
    if (!user.email || !user.email.includes("@") || user.is_placeholder_email) {
      skippedNoEmail++;
      continue;
    }

    eligibleRecipients.push(user);
  }

  const recipientsStatus: BroadcastResult["recipients"] = [];
  let sentCount = 0;

  for (const recipient of eligibleRecipients) {
    const recipientName =
      recipient.firstName && recipient.lastName
        ? `${recipient.firstName} ${recipient.lastName}`
        : recipient.name || "Sportkamerad";

    try {
      const sendRes = await sendNotificationMail({
        eventKey: "HOBBYLIGA_NEW_POST",
        recipientEmail: recipient.email!,
        recipientName,
        payload: {
          user_name: recipientName,
          league_name: payload.leagueName || "Hobbyliga",
          author_name: payload.authorName || "Ein Vereinsmitglied",
          post_title: payload.postTitle,
          post_content: payload.postContent,
          league_link: "https://tennis-club.app/hobbyliga",
          club_name: clubName,
        },
        clubName,
      });

      if (sendRes.success) {
        sentCount++;
        recipientsStatus.push({
          id: recipient.id || recipient.name,
          name: recipientName,
          email: recipient.email!,
          status: sendRes.status,
          simulated: sendRes.simulated,
        });
      } else {
        recipientsStatus.push({
          id: recipient.id || recipient.name,
          name: recipientName,
          email: recipient.email!,
          status: "failed",
          error: sendRes.message,
        });
      }
    } catch (err: any) {
      console.error(`Failed to send broadcast mail to ${recipient.email}:`, err);
      recipientsStatus.push({
        id: recipient.id || recipient.name,
        name: recipientName,
        email: recipient.email!,
        status: "failed",
        error: err.message,
      });
    }
  }

  return {
    success: true,
    totalCandidates: eligibleRecipients.length,
    sentCount,
    skippedAuthor,
    skippedOptOut,
    skippedNoEmail,
    recipients: recipientsStatus,
  };
}

/**
 * Event 'MATCH_RESULT_SUBMITTED':
 * Benachrichtigung über ein eingetragenes Spielergebnis.
 * Strikt gefiltert, sodass NUR der gegnerische Spieler die E-Mail erhält.
 * Sendet niemals an den übermittelnden Spieler.
 */
export async function notifyMatchResultSubmitted(
  payload: MatchResultNotificationPayload,
  users: Record<string, User> | User[],
  clubName = "Tennis-Club e.V."
): Promise<MatchResultNotificationResult> {
  // Master-Kill-Switch check
  const vereinsId = payload.vereinsId || "sv-neuhausen";
  if (await isGlobalEmailPaused(vereinsId)) {
    console.info(`[NotificationDispatcher] E-Mail-Versand ist im Verein '${vereinsId}' global pausiert (Not-Aus).`);
    return {
      success: true,
      sent: false,
      opponentId: payload.opponentId,
      reason: "Gesamter E-Mail-Versand des Vereins ist global pausiert (Not-Aus aktiv).",
    };
  }

  const isGloballyActive = await isEventGloballyActive(vereinsId, "MATCH_RESULT_SUBMITTED");
  if (!isGloballyActive) {
    console.info(`[NotificationDispatcher] 'MATCH_RESULT_SUBMITTED' ist im Verein '${vereinsId}' global deaktiviert. Keine E-Mail versendet.`);
    return {
      success: true,
      sent: false,
      opponentId: payload.opponentId,
      reason: "Event MATCH_RESULT_SUBMITTED systemweit vom Verein deaktiviert.",
    };
  }

  const usersList: User[] = Array.isArray(users) ? users : Object.values(users);

  // 1. Strict filter: Opponent must not be the submitter
  if (payload.opponentId === payload.submitterId) {
    return {
      success: false,
      sent: false,
      opponentId: payload.opponentId,
      reason: "Eintragender Spieler und gegnerischer Spieler sind identisch.",
    };
  }

  // 2. Find opponent user record
  const opponent = usersList.find(
    (u) =>
      u.id === payload.opponentId ||
      u.name === payload.opponentId ||
      u.email === payload.opponentId
  );

  if (!opponent) {
    return {
      success: false,
      sent: false,
      opponentId: payload.opponentId,
      reason: `Gegnerischer Spieler mit ID/Name „${payload.opponentId}“ nicht gefunden.`,
    };
  }

  // 3. Check opponent notification preference
  const settings = opponent.notification_settings || opponent.notificationSettings;
  const isEnabled = settings?.MATCH_RESULT_SUBMITTED !== false;
  if (!isEnabled) {
    return {
      success: true,
      sent: false,
      opponentId: payload.opponentId,
      opponentName: opponent.name,
      opponentEmail: opponent.email,
      reason: "Gegner hat Benachrichtigungen für Spielergebnisse deaktiviert (Opt-out).",
    };
  }

  // 4. Validate opponent email
  if (!opponent.email || !opponent.email.includes("@") || opponent.is_placeholder_email) {
    return {
      success: false,
      sent: false,
      opponentId: payload.opponentId,
      opponentName: opponent.name,
      reason: "Gegner besitzt keine gültige E-Mail-Adresse.",
    };
  }

  const opponentDisplayName =
    opponent.firstName && opponent.lastName
      ? `${opponent.firstName} ${opponent.lastName}`
      : opponent.name || payload.opponentName || "Sportkamerad";

  const submitterDisplayName = payload.submitterName || "Dein Spielpartner";

  try {
    const sendResult = await sendNotificationMail({
      eventKey: "MATCH_RESULT_SUBMITTED",
      recipientEmail: opponent.email,
      recipientName: opponentDisplayName,
      payload: {
        user_name: opponentDisplayName,
        opponent_name: opponentDisplayName,
        submitter_name: submitterDisplayName,
        result_score: payload.resultScore,
        match_date: payload.matchDate || new Date().toLocaleDateString("de-DE"),
        league_name: payload.leagueName || "Hobbyliga",
        court_name: payload.courtName || "Tennisplatz",
        match_link: "https://tennis-club.app/hobbyliga?tab=results",
        club_name: clubName,
      },
      clubName,
    });

    return {
      success: sendResult.success,
      sent: sendResult.success,
      opponentId: payload.opponentId,
      opponentName: opponentDisplayName,
      opponentEmail: opponent.email,
      result: sendResult,
      reason: sendResult.success
        ? `Benachrichtigung erfolgreich an Gegner ${opponent.email} versendet.`
        : sendResult.message,
    };
  } catch (err: any) {
    console.error("Failed to send match result notification to opponent:", err);
    return {
      success: false,
      sent: false,
      opponentId: payload.opponentId,
      opponentName: opponentDisplayName,
      opponentEmail: opponent.email,
      reason: err.message || "Fehler beim E-Mail-Versand an den Gegner.",
    };
  }
}

export interface BookingModifiedNotificationResult {
  success: boolean;
  totalRecipients: number;
  sentCount: number;
  skippedOptOut: number;
  skippedNoEmail: number;
  recipients: Array<{
    name: string;
    email: string;
    status: string;
    simulated?: boolean;
    error?: string;
  }>;
}

/**
 * Event 'RESERVATION_MODIFIED':
 * Versendet eine E-Mail über eine geänderte bzw. umgebuchte Platzreservierung.
 * Informiert das buchende Mitglied und optional Mitspieler.
 * Respektiert individuelle Opt-out-Einstellungen (RESERVATION_MODIFIED: false).
 */
export async function notifyBookingModified(
  payload: BookingModifiedNotificationPayload,
  users: Record<string, User> | User[],
  clubName = "Tennis-Club e.V."
): Promise<BookingModifiedNotificationResult> {
  // Master-Kill-Switch check
  const vereinsId = payload.vereinsId || "sv-neuhausen";
  if (await isGlobalEmailPaused(vereinsId)) {
    console.info(`[NotificationDispatcher] E-Mail-Versand ist im Verein '${vereinsId}' global pausiert (Not-Aus).`);
    return {
      success: true,
      totalRecipients: 0,
      sentCount: 0,
      skippedOptOut: 0,
      skippedNoEmail: 0,
      recipients: [],
    };
  }

  const isGloballyActive = await isEventGloballyActive(vereinsId, "RESERVATION_MODIFIED");
  if (!isGloballyActive) {
    console.info(`[NotificationDispatcher] 'RESERVATION_MODIFIED' ist im Verein '${vereinsId}' global deaktiviert. Keine E-Mails versendet.`);
    return {
      success: true,
      totalRecipients: 0,
      sentCount: 0,
      skippedOptOut: 0,
      skippedNoEmail: 0,
      recipients: [],
    };
  }

  const usersList: User[] = Array.isArray(users) ? users : Object.values(users);

  // Collect potential recipient user records
  const targetMap = new Map<string, { name: string; email: string; settings?: any }>();

  // 1. Direct recipient if specified
  if (payload.recipientEmail && payload.recipientEmail.includes("@")) {
    targetMap.set(payload.recipientEmail.toLowerCase(), {
      name: payload.userName || "Vereinsmitglied",
      email: payload.recipientEmail,
    });
  }

  // 2. Booking owner by userId / userName / userEmail
  const owner = usersList.find(
    (u) =>
      (payload.userId && (u.id === payload.userId || u.name === payload.userId)) ||
      (payload.userName && (u.name === payload.userName || u.klarname === payload.userName)) ||
      (payload.userEmail && u.email?.toLowerCase() === payload.userEmail.toLowerCase())
  );
  if (owner && owner.email && owner.email.includes("@") && !owner.is_placeholder_email) {
    const ownerName = owner.klarname || (owner.firstName && owner.lastName ? `${owner.firstName} ${owner.lastName}` : owner.name);
    targetMap.set(owner.email.toLowerCase(), {
      name: ownerName || "Vereinsmitglied",
      email: owner.email,
      settings: owner.notification_settings || owner.notificationSettings,
    });
  }

  // 3. Players listed on the booking
  if (Array.isArray(payload.players)) {
    for (const pName of payload.players) {
      if (!pName || typeof pName !== "string") continue;
      const cleanP = pName.trim().toLowerCase();
      const matched = usersList.find(
        (u) =>
          u.name?.toLowerCase() === cleanP ||
          u.username?.toLowerCase() === cleanP ||
          u.klarname?.toLowerCase() === cleanP ||
          `${u.firstName} ${u.lastName}`.toLowerCase() === cleanP
      );
      if (matched && matched.email && matched.email.includes("@") && !matched.is_placeholder_email) {
        const pDisp = matched.klarname || (matched.firstName && matched.lastName ? `${matched.firstName} ${matched.lastName}` : matched.name);
        targetMap.set(matched.email.toLowerCase(), {
          name: pDisp || pName,
          email: matched.email,
          settings: matched.notification_settings || matched.notificationSettings,
        });
      }
    }
  }

  let sentCount = 0;
  let skippedOptOut = 0;
  let skippedNoEmail = 0;
  const recipientsStatus: BookingModifiedNotificationResult["recipients"] = [];

  const playersString = Array.isArray(payload.players) && payload.players.length > 0
    ? payload.players.join(", ")
    : payload.userName || "Einzelspiel";

  for (const recipient of targetMap.values()) {
    if (!recipient.email || !recipient.email.includes("@")) {
      skippedNoEmail++;
      continue;
    }

    if (recipient.settings?.RESERVATION_MODIFIED === false) {
      skippedOptOut++;
      continue;
    }

    try {
      const sendRes = await sendNotificationMail({
        eventKey: "RESERVATION_MODIFIED",
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        payload: {
          user_name: recipient.name,
          court_name: payload.courtName,
          date: payload.date,
          time: payload.time,
          old_court_name: payload.oldCourtName || payload.courtName,
          old_date: payload.oldDate || payload.date,
          old_time: payload.oldTime || payload.time,
          players: playersString,
          cancellation_link: payload.cancellationLink || "https://tennis-club.app/meine-buchungen",
          booking_id: payload.bookingId || "BK-AKTUELL",
          club_name: clubName,
        },
        clubName,
      });

      if (sendRes.success) {
        sentCount++;
        recipientsStatus.push({
          name: recipient.name,
          email: recipient.email,
          status: sendRes.status,
          simulated: sendRes.simulated,
        });
      } else {
        recipientsStatus.push({
          name: recipient.name,
          email: recipient.email,
          status: "failed",
          error: sendRes.message,
        });
      }
    } catch (err: any) {
      console.error(`Failed to send RESERVATION_MODIFIED mail to ${recipient.email}:`, err);
      recipientsStatus.push({
        name: recipient.name,
        email: recipient.email,
        status: "failed",
        error: err.message,
      });
    }
  }

  return {
    success: true,
    totalRecipients: targetMap.size,
    sentCount,
    skippedOptOut,
    skippedNoEmail,
    recipients: recipientsStatus,
  };
}

