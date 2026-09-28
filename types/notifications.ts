/**
 * Data models and interfaces for the notification and email template system.
 */

export type NotificationEventKey =
  | "RESERVATION_CONFIRMED"
  | "RESERVATION_CANCELLED"
  | "RESERVATION_MODIFIED"
  | "HOBBYLIGA_NEW_POST"
  | "MATCH_RESULT_SUBMITTED"
  | string;

export interface UserNotificationSettings {
  HOBBYLIGA_NEW_POST?: boolean;
  MATCH_RESULT_SUBMITTED?: boolean;
  RESERVATION_CONFIRMED?: boolean;
  RESERVATION_CANCELLED?: boolean;
  RESERVATION_MODIFIED?: boolean;
  [key: string]: boolean | undefined;
}

export type SystemwideNotificationSettings = Record<string, boolean>;

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

export type EmailFontFamily =
  | "system-sans"
  | "arial"
  | "trebuchet"
  | "georgia"
  | "times"
  | "courier"
  | "verdana"
  | "sans"
  | "serif"
  | "mono";

export type TemplateBlockType = "text" | "button" | "image" | "header";

export interface HeaderBlockConfig {
  logoUrl?: string;
  logoAlt?: string;
  logoHeight?: number; // e.g. 44 in px
  title: string;
  subtitle?: string;
  fontFamily?: EmailFontFamily;
  fontSize?: number; // Title font size e.g. 20
  subtitleFontSize?: number; // Subtitle font size e.g. 13
  lineHeight?: number; // e.g. 1.3
  textAlign?: "left" | "center" | "right";
  paddingY?: number; // in px, e.g. 20
  paddingX?: number; // in px, e.g. 24
  color?: string; // Title / text color, e.g. #ffffff or #0f172a
  subtitleColor?: string; // Subtitle color, e.g. #94a3b8 or #64748b
  backgroundColor?: string; // background color, e.g. #064e3b or #ffffff
}

export interface TextBlockConfig {
  content: string; // Text containing [Badges] or {{variables}}
  fontFamily?: EmailFontFamily;
  fontSize?: number; // e.g. 15
  lineHeight?: number; // e.g. 1.6
  textAlign?: "left" | "center" | "right";
  paddingY?: number; // in px
  paddingX?: number; // in px
  color?: string; // text color, e.g. #334155
  backgroundColor?: string; // tile background color, e.g. #f8fafc or transparent
}

export interface ButtonBlockConfig {
  label: string; // e.g. "Buchung verwalten oder stornieren"
  linkType: "dynamic" | "static";
  dynamicLinkKey: string; // e.g. "cancellation_link" | "league_link" | "match_link"
  staticUrl: string; // e.g. "https://tennis-club.app"
  align: "left" | "center" | "right";
  paddingY: number; // vertical padding, e.g. 12
  paddingX: number; // horizontal padding, e.g. 24
  shape: "pill" | "rounded" | "square";
  buttonColor: string; // primary button color, e.g. #047857
  textColor: string; // button label color, e.g. #ffffff
  backgroundColor?: string; // surrounding block background, e.g. "transparent"
}

export interface ImageBlockConfig {
  imageUrl: string;
  altText?: string;
  widthUnit: "%" | "px";
  widthValue: number; // e.g. 100 or 250
  align: "left" | "center" | "right";
  targetUrl?: string; // optional hyperlink
  paddingY?: number;
  paddingX?: number;
}

export interface TemplateBlock {
  id: string;
  type: TemplateBlockType;
  columnSpan?: "full" | "half" | "third"; // "full" = 100%, "half" = 50%, "third" = 33.3%
  config: TextBlockConfig | ButtonBlockConfig | ImageBlockConfig | HeaderBlockConfig;
}

export interface EmailTemplateGlobalSettings {
  fontFamily?: EmailFontFamily;
  primaryColor?: string;
  backgroundColor?: string;
}

export interface EmailTemplate {
  id: string; // unique template ID (e.g. "default_reservation_confirmed", "tmpl_172743...")
  name: string;
  eventType: NotificationEventKey; // Fest zugeordneter Anwendungsfall (z. B. RESERVATION_CONFIRMED)
  description?: string;
  subject: string;
  bodyHtml?: string;
  blocks?: TemplateBlock[];
  globalSettings?: EmailTemplateGlobalSettings;
  availableVariables?: string[];
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
  deletedAt?: string | null; // ISO-Timestamp for 30-day soft delete / recycle bin
}

export type EmailTemplateAssignments = Record<string, string>; // eventKey -> templateId


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
  vereinsId?: string;
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

export interface BookingModifiedNotificationPayload {
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
}


