/**
 * Data models and interfaces for the notification and email template system.
 */

export type NotificationEventKey =
  | "RESERVATION_CONFIRMED"
  | "RESERVATION_CANCELLED"
  | "HOBBYLIGA_NEW_POST"
  | "MATCH_RESULT_SUBMITTED"
  | string;

export interface UserNotificationSettings {
  HOBBYLIGA_NEW_POST?: boolean;
  MATCH_RESULT_SUBMITTED?: boolean;
  RESERVATION_CONFIRMED?: boolean;
  RESERVATION_CANCELLED?: boolean;
  [key: string]: boolean | undefined;
}

export interface NotificationEventDefinition {
  key: NotificationEventKey;
  label: string;
  category: "hobbyliga" | "matches" | "booking";
  description: string;
  defaultEnabled: boolean;
  targetAudience: string;
}

export interface TemplateVariableInfo {
  key: string; // e.g. "user_name"
  placeholder: string; // e.g. "{{user_name}}"
  label: string; // e.g. "Name des Spielers"
  description: string;
  example: string;
}

export interface EmailTemplate {
  id: NotificationEventKey;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
  availableVariables: string[];
  updatedAt?: string;
  updatedBy?: string;
}

export interface NotificationEvent {
  eventKey: NotificationEventKey;
  recipientEmail: string;
  recipientName?: string;
  payload: Record<string, any>;
  sentAt?: string;
  status?: "sent" | "failed" | "simulated";
  error?: string;
}

export interface SendMailOptions {
  eventKey: NotificationEventKey;
  recipientEmail: string;
  recipientName?: string;
  payload: Record<string, any>;
  customTemplate?: Partial<EmailTemplate>;
  clubName?: string;
  clubLogoUrl?: string;
}

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  status: "sent" | "failed" | "simulated";
  message: string;
  renderedSubject?: string;
  renderedHtml?: string;
  error?: string;
}

export interface BulkUpdateNotificationsPayload {
  userIds: string[];
  eventKey: NotificationEventKey;
  enabled: boolean;
  vereinsId?: string;
}

export interface HobbyligaBroadcastPayload {
  authorId: string;
  authorName: string;
  leagueId?: string;
  leagueName?: string;
  postTitle: string;
  postContent: string;
  vereinsId?: string;
}

export interface MatchResultNotificationPayload {
  submitterId: string;
  submitterName: string;
  opponentId: string;
  opponentName?: string;
  resultScore: string;
  matchDate?: string;
  leagueName?: string;
  courtName?: string;
  vereinsId?: string;
}

