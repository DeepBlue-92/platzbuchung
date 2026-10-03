import {
  TemplateBlock,
  TextBlockConfig,
  ButtonBlockConfig,
  ImageBlockConfig,
  HeaderBlockConfig,
  ColumnsBlockConfig,
  ColumnDefinition,
  ColumnChildBlock,
  EmailTemplateGlobalSettings,
  EmailFontFamily,
} from "../types/notifications";
import { AVAILABLE_TEMPLATE_VARIABLES } from "./notificationTemplates";

/**
 * 100% DSGVO- & datenschutzkonforme, lokale Web-Safe Schriftarten
 * Ohne externe CDNs / Google Fonts; rendert nativ auf allen Betriebssystemen & E-Mail-Clients.
 */
export const EMAIL_FONT_OPTIONS = [
  {
    id: "system-sans",
    label: "System Sans (Modern)",
    stack: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  {
    id: "arial",
    label: "Arial / Helvetica (Neutral)",
    stack: "Arial, Helvetica, sans-serif",
  },
  {
    id: "trebuchet",
    label: "Trebuchet MS (Prägnant)",
    stack: "'Trebuchet MS', 'Lucida Sans Unicode', sans-serif",
  },
  {
    id: "georgia",
    label: "Georgia (Elegant Serif)",
    stack: "Georgia, Cambria, 'Times New Roman', serif",
  },
  {
    id: "times",
    label: "Times New Roman (Klassisch)",
    stack: "'Times New Roman', Times, serif",
  },
  {
    id: "courier",
    label: "Courier New (Monospace)",
    stack: "'Courier New', Courier, monospace",
  },
  {
    id: "verdana",
    label: "Verdana (Hohe Lesbarkeit)",
    stack: "Verdana, Geneva, sans-serif",
  },
] as const;

/**
 * Mapping of variable keys to user-facing badge labels.
 * E.g. user_name -> "Spieler-Name"
 */
export const VARIABLE_BADGE_MAP: Record<string, string> = {
  user_name: "Spieler-Name",
  court_name: "Platz-Bezeichnung",
  date: "Datum",
  time: "Uhrzeit",
  old_court_name: "Vorheriger Platz",
  old_date: "Vorheriges Datum",
  old_time: "Vorherige Uhrzeit",
  players: "Mitspieler / Partner",
  cancellation_link: "Stornierungs-Link",
  club_name: "Vereinsname",
  booking_id: "Buchungs-Nummer",
  league_name: "Liga-Name",
  author_name: "Verfasser-Name",
  post_title: "Beitrags-Titel",
  post_content: "Beitrags-Text",
  league_link: "Hobbyliga-Link",
  submitter_name: "Eintragender Spieler",
  opponent_name: "Gegner-Name",
  result_score: "Match-Ergebnis",
  match_date: "Match-Datum",
  match_link: "Match-Link",
  booking_link: "Buchungs-Link",
  activation_link: "Aktivierungs-Link",
  password_reset_link: "Passwort-Reset-Link",
  link_validity_hours: "Gültigkeitsdauer",
};

/**
 * Reverse mapping from badge label to variable key
 */
export const BADGE_TO_VARIABLE_MAP: Record<string, string> = Object.entries(
  VARIABLE_BADGE_MAP
).reduce((acc, [key, badge]) => {
  const clean = badge.replace(/^\[|\]$/g, "").toLowerCase();
  acc[clean] = key;
  acc[`[${clean}]`] = key;
  return acc;
}, {} as Record<string, string>);

/**
 * Available dynamic link targets for Button blocks
 */
export const AVAILABLE_DYNAMIC_LINKS = [
  { key: "activation_link", label: "Aktivierungs-Link (Initiale Passwortvergabe)", description: "Generiert sicheren Token-Link {{activation_link}}" },
  { key: "password_reset_link", label: "Passwort-Reset-Link", description: "Generiert sicheren Token-Link {{password_reset_link}}" },
  { key: "cancellation_link", label: "Stornierungs-Link", description: "Direktlink zur Stornierung / Buchungsübersicht" },
  { key: "cancellation_link", label: "Umbuchungs-Link", description: "Direktlink zur Umbuchung / Bearbeitung" },
  { key: "league_link", label: "Hobbyliga-Link", description: "Direktlink zur Hobbyliga & Pinnwand" },
  { key: "match_link", label: "Match-Link", description: "Direktlink zur Spielansicht & Bestätigung" },
  { key: "booking_link", label: "Buchungs-Link", description: "Direktlink zum Buchungskalender" },
];

/**
 * Converts badge tokens like "[Spieler-Name]" or "Spieler-Name" to Handlebars tags "{{{user_name}}}"
 */
export function convertBadgesToHandlebars(text: string): string {
  if (!text) return "";
  let result = text;
  for (const [key, rawBadge] of Object.entries(VARIABLE_BADGE_MAP)) {
    const cleanBadge = rawBadge.replace(/^\[|\]$/g, "");
    const escaped = cleanBadge.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Replace bracketed version [Badge] first
    result = result.replace(new RegExp(`\\[\\s*${escaped}\\s*\\]`, "gi"), `{{{${key}}}}`);
    // Also replace bracketed key [key] e.g. [activation_link]
    result = result.replace(new RegExp(`\\[\\s*${key}\\s*\\]`, "gi"), `{{{${key}}}}`);
    // Replace standalone badge token if it's hyphenated or distinct
    if (cleanBadge.includes("-") || ["club_name", "players", "link_validity_hours", "activation_link", "password_reset_link"].includes(key)) {
      result = result.replace(new RegExp(`\\b${escaped}\\b`, "gi"), `{{{${key}}}}`);
    }
  }
  // Convert any existing double-brace Handlebars variables to triple-brace so HTML isn't escaped
  result = result.replace(/(?<!\{)\{\{\s*([a-zA-Z0-9_]+)\s*\}\}(?!\})/g, "{{{$1}}}");
  return result;
}

/**
 * Converts Handlebars tags "{{user_name}}" to user-friendly badge tokens
 */
export function convertHandlebarsToBadges(text: string): string {
  if (!text) return "";
  let result = text;
  for (const [key, rawBadge] of Object.entries(VARIABLE_BADGE_MAP)) {
    const cleanBadge = rawBadge.replace(/^\[|\]$/g, "");
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi");
    result = result.replace(regex, `[${cleanBadge}]`);
  }
  return result;
}

/**
 * Returns dynamic fields payload for test emails and previews with unified italic badges.
 * Fields that are dynamically populated are marked uniformly (italic with subtle badge frame)
 * matching the template canvas display 1:1.
 */
export function getDynamicTestPayload(clubName = "Tennis-Club e.V."): Record<string, string> {
  const payload: Record<string, string> = {
    club_name: clubName,
  };
  for (const [key, rawBadge] of Object.entries(VARIABLE_BADGE_MAP)) {
    const clean = rawBadge.replace(/^\[|\]$/g, "");
    payload[key] = `<em style="font-style: italic; font-weight: 600; color: #1e293b; background-color: #f1f5f9; padding: 1px 6px; border-radius: 4px; border: 1px solid #cbd5e1; display: inline-block;">[${clean}]</em>`;
  }
  return payload;
}

/**
 * Replaces badge tokens and "{{user_name}}" with preview data values.
 */
export function replaceTokensWithPreview(
  text: string,
  payload: Record<string, any> = {}
): string {
  if (!text) return "";
  let result = text;

  for (const [key, rawBadge] of Object.entries(VARIABLE_BADGE_MAP)) {
    const val = payload[key] !== undefined && payload[key] !== null ? String(payload[key]) : "";
    if (val) {
      const cleanBadge = rawBadge.replace(/^\[|\]$/g, "");
      const escaped = cleanBadge.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(new RegExp(`\\[\\s*${escaped}\\s*\\]`, "gi"), val);
      result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi"), val);
      if (cleanBadge.includes("-") || ["club_name", "players"].includes(key)) {
        result = result.replace(new RegExp(`\\b${escaped}\\b`, "gi"), val);
      }
    }
  }

  // Also replace any remaining {{key}} with payload[key] or fallback
  result = result.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
    return payload[k] !== undefined && payload[k] !== null ? String(payload[k]) : "";
  });

  return result;
}

/**
 * Font family CSS values: 100% datenschutzkonforme, lokale Web-Safe Stacks
 */
export function getFontFamilyCss(family?: EmailFontFamily): string {
  switch (family) {
    case "arial":
      return "Arial, Helvetica, sans-serif";
    case "trebuchet":
      return "'Trebuchet MS', 'Lucida Sans Unicode', sans-serif";
    case "georgia":
    case "serif":
      return "Georgia, Cambria, 'Times New Roman', serif";
    case "times":
      return "'Times New Roman', Times, serif";
    case "courier":
    case "mono":
      return "'Courier New', Courier, monospace";
    case "verdana":
      return "Verdana, Geneva, sans-serif";
    case "system-sans":
    case "sans":
    default:
      return "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  }
}

/**
 * Generates email-client safe, table-based HTML from an array of blocks.
 * Designed to render flawlessly across Apple Mail, Gmail, and Outlook (MSO).
 * Supports 2-column tile layouts (Workday-style) and edge-to-edge section control.
 */
export function compileSingleBlockHtml(
  block: TemplateBlock,
  globalFont: EmailFontFamily = "system-sans"
): string {
  const defaultFontCss = getFontFamilyCss(globalFont);

  switch (block.type) {
    case "text": {
      const cfg = block.config as TextBlockConfig;
      const fontCss = getFontFamilyCss(cfg.fontFamily || globalFont);
      const fontSize = cfg.fontSize || 15;
      const lineHeight = cfg.lineHeight || 1.6;
      const textAlign = cfg.textAlign || "left";
      const paddingY = cfg.paddingY !== undefined ? cfg.paddingY : 12;
      const paddingX = cfg.paddingX !== undefined ? cfg.paddingX : 20;
      const color = cfg.color || "#334155";
      const bgColor = cfg.backgroundColor || "transparent";

      // Convert badges to Handlebars variables for backend rendering
      const contentWithHandlebars = convertBadgesToHandlebars(cfg.content || "");

      // Convert double newlines into clean paragraph spacing, single newlines into <br />
      const paragraphs = contentWithHandlebars
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);

      const htmlParagraphs = paragraphs.length > 0
        ? paragraphs
            .map((p, idx) => {
              const lineFormatted = p.replace(/\n/g, "<br />");
              const marginBottom = idx === paragraphs.length - 1 ? 0 : 12;
              return `<p style="margin: 0 0 ${marginBottom}px 0; font-family: ${fontCss}; font-size: ${fontSize}px; line-height: ${lineHeight}; color: ${color}; text-align: ${textAlign};">${lineFormatted}</p>`;
            })
            .join("")
        : `<p style="margin: 0; font-family: ${fontCss}; font-size: ${fontSize}px; line-height: ${lineHeight}; color: ${color}; text-align: ${textAlign};">${contentWithHandlebars}</p>`;

      return `<!-- Block: Text -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${bgColor}; border-collapse: collapse;">
  <tr>
    <td style="padding: ${paddingY}px ${paddingX}px; font-family: ${fontCss}; font-size: ${fontSize}px; line-height: ${lineHeight}; color: ${color}; text-align: ${textAlign};">
      ${htmlParagraphs}
    </td>
  </tr>
</table>`;
    }

    case "button": {
      const cfg = block.config as ButtonBlockConfig;
      const align = cfg.align || "left";
      const paddingY = cfg.paddingY !== undefined ? cfg.paddingY : 12;
      const paddingX = cfg.paddingX !== undefined ? cfg.paddingX : 24;
      const buttonColor = cfg.buttonColor || "#047857";
      const textColor = cfg.textColor || "#ffffff";
      const backgroundColor = cfg.backgroundColor || "transparent";
      const label = cfg.label || "Aktion ausführen";

      let borderRadius = "8px";
      let msoArcSize = "15%";
      if (cfg.shape === "pill") {
        borderRadius = "9999px";
        msoArcSize = "50%";
      } else if (cfg.shape === "square") {
        borderRadius = "0px";
        msoArcSize = "0%";
      }

      // Link resolution
      let href = "#";
      if (cfg.linkType === "dynamic") {
        href = `{{${cfg.dynamicLinkKey || "cancellation_link"}}}`;
      } else {
        href = cfg.staticUrl || "https://tennis-club.app";
      }

      return `<!-- Block: Button -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${backgroundColor}; border-collapse: collapse;">
  <tr>
    <td align="${align}" style="padding: ${paddingY}px ${paddingX}px;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:44px;v-text-anchor:middle;width:240px;" arcsize="${msoArcSize}" stroke="f" fillcolor="${buttonColor}">
        <w:anchorlock/>
        <center style="color:${textColor};font-family:${defaultFontCss};font-size:14px;font-weight:bold;">${label}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate;">
        <tr>
          <td align="center" style="border-radius: ${borderRadius}; background-color: ${buttonColor};">
            <a href="${href}" target="_blank" style="display: inline-block; padding: 12px 24px; font-family: ${defaultFontCss}; font-size: 14px; font-weight: 700; color: ${textColor}; text-decoration: none; border-radius: ${borderRadius}; background-color: ${buttonColor}; line-height: 20px;">
              ${label}
            </a>
          </td>
        </tr>
      </table>
      <!--<![endif]-->
    </td>
  </tr>
</table>`;
    }

    case "image": {
      const cfg = block.config as ImageBlockConfig;
      const align = cfg.align || "center";
      const paddingY = cfg.paddingY !== undefined ? cfg.paddingY : 12;
      const paddingX = cfg.paddingX !== undefined ? cfg.paddingX : 0;
      const widthVal = cfg.widthValue || 100;
      const widthUnit = cfg.widthUnit || "%";
      const widthCss = widthUnit === "%" ? `${widthVal}%` : `${widthVal}px`;
      const altText = cfg.altText || "Grafik";
      const imageUrl = cfg.imageUrl || "https://placehold.co/600x160/047857/ffffff?text=Vereinsgrafik";

      const imageTag = `<img src="${imageUrl}" alt="${altText}" border="0" style="display: inline-block; max-width: 100%; width: ${widthCss}; height: auto; outline: none; border: 0; text-decoration: none; border-radius: 0px;" />`;

      return `<!-- Block: Image / Banner -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
  <tr>
    <td align="${align}" style="padding: ${paddingY}px ${paddingX}px;">
      ${cfg.targetUrl ? `<a href="${cfg.targetUrl}" target="_blank" style="text-decoration: none; display: inline-block;">${imageTag}</a>` : imageTag}
    </td>
  </tr>
</table>`;
    }

    case "columns": {
      const cfg = block.config as ColumnsBlockConfig;
      const columns = cfg.columns || [];
      const gap = 0; // Fix auf 0px festgesetzt
      const paddingY = cfg.paddingY !== undefined ? cfg.paddingY : 12;
      const paddingX = cfg.paddingX !== undefined ? cfg.paddingX : 0;
      const bgColor = cfg.backgroundColor || "transparent";
      const vAlign = "middle"; // Immer fest vertikal zentriert

      const count = columns.length;
      if (count === 0) return "";

      const bgImgAttr = cfg.backgroundImageUrl ? `background="${cfg.backgroundImageUrl}"` : "";
      const bgImgCss = cfg.backgroundImageUrl
        ? `background-image: url('${cfg.backgroundImageUrl}'); background-size: cover; background-position: center; background-repeat: no-repeat;`
        : "";

      const colTds = columns.map((col, idx) => {
        const childBlocksHtml = (col.blocks || []).map((cb) => {
          if (cb.type === "image") {
            const asTBlock: TemplateBlock = {
              id: cb.id,
              type: cb.type,
              config: { ...cb.config, align: "center" },
            };
            return compileSingleBlockHtml(asTBlock, globalFont);
          }

          if (cb.type === "text") {
            const txt = (cb.config as TextBlockConfig).content || "";
            const lines = txt.split("\n");
            let titleLine = lines[0] || "";
            let subtitleLine = lines.slice(1).join("\n") || "";
            if (titleLine.trim() === "[Vereinsname]") titleLine = "";
            if (subtitleLine.trim() === "Offizielle Mitteilung") subtitleLine = "";

            const titleFont = getFontFamilyCss(cfg.titleFontFamily || globalFont);
            const titleSize = cfg.titleFontSize || 18;
            const titleColor = cfg.titleColor || "#0f172a";

            const subFont = getFontFamilyCss(cfg.subtitleFontFamily || globalFont);
            const subSize = cfg.subtitleFontSize || 13;
            const subColor = cfg.subtitleColor || "#64748b";

            const titlePart = titleLine
              ? `<div style="font-family: ${titleFont}; font-size: ${titleSize}px; font-weight: 800; color: ${titleColor}; line-height: 1.3; margin: 0; padding: 0;">${convertBadgesToHandlebars(titleLine)}</div>`
              : "";
            const subPart = subtitleLine
              ? `<div style="font-family: ${subFont}; font-size: ${subSize}px; font-weight: 500; color: ${subColor}; line-height: 1.4; margin-top: 4px; padding: 0;">${convertBadgesToHandlebars(subtitleLine)}</div>`
              : "";

            return `<div style="padding: 0; margin: 0;">${titlePart}${subPart}</div>`;
          }

          const asTBlock: TemplateBlock = {
            id: cb.id,
            type: cb.type,
            config: cb.config,
          };
          return compileSingleBlockHtml(asTBlock, globalFont);
        }).join("\n");

        return `<td class="email-column" width="${col.widthPercent}%" valign="${vAlign}" align="${idx === 0 ? "center" : "left"}" style="width: ${col.widthPercent}%; padding-left: 0px; padding-right: 0px; vertical-align: ${vAlign}; text-align: ${idx === 0 ? "center" : "left"}; box-sizing: border-box;">
          ${childBlocksHtml}
        </td>`;
      }).join("\n");

      return `<!-- Block: Kopfzeile (Wappen/Logo links, Text rechts, Gap: 0px) -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" ${bgImgAttr} style="background-color: ${bgColor}; ${bgImgCss} border-collapse: collapse; box-sizing: border-box;">
  <tr>
    <td style="padding: ${paddingY}px ${paddingX}px; box-sizing: border-box;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; table-layout: fixed; width: 100%; box-sizing: border-box;">
        <tr>
          ${colTds}
        </tr>
      </table>
    </td>
  </tr>
</table>`;
    }

    case "header": {
      const cfg = block.config as HeaderBlockConfig;
      const fontCss = getFontFamilyCss(cfg.fontFamily || globalFont);
      const fontSize = cfg.fontSize || 18;
      const lineHeight = cfg.lineHeight || 1.4;
      const textAlign = cfg.textAlign || "left";
      const textColor = cfg.textColor || cfg.color || "#0f172a";
      const paddingY = cfg.paddingY !== undefined ? cfg.paddingY : 16;
      const paddingX = cfg.paddingX !== undefined ? cfg.paddingX : 0;
      const bgColor = cfg.backgroundColor || "transparent";
      const logoWidth = cfg.logoWidth || 72;

      // Raw text content with fallbacks
      const rawText =
        cfg.textContent !== undefined
          ? cfg.textContent
          : cfg.title
          ? cfg.subtitle
            ? `${cfg.title}\n${cfg.subtitle}`
            : cfg.title
          : "";

      const textHtml = convertBadgesToHandlebars(rawText).replace(/\n/g, "<br/>");

      const logoImgTag = cfg.logoUrl
        ? `<img src="${cfg.logoUrl}" alt="${cfg.logoAlt || 'Logo'}" width="${logoWidth}" height="${logoWidth}" border="0" style="display: block; width: ${logoWidth}px; max-width: ${logoWidth}px; height: ${logoWidth}px; max-height: ${logoWidth}px; object-fit: contain; border: 0; outline: none; text-decoration: none;" />`
        : "";

      return `<!-- Block: Kopfzeile (Quadratisches Logo links, Text rechts - vertikal zentriert) -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${bgColor}; border-collapse: collapse; box-sizing: border-box;">
  <tr>
    <td style="padding: ${paddingY}px ${paddingX}px; box-sizing: border-box;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; width: 100%; box-sizing: border-box;">
        <tr>
          <td valign="middle" align="left" style="width: ${logoWidth}px; max-width: ${logoWidth}px; vertical-align: middle; padding-right: 16px; box-sizing: border-box;">
            ${logoImgTag || `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="${logoWidth}" height="${logoWidth}" style="width: ${logoWidth}px; height: ${logoWidth}px; border: 1px dashed #cbd5e1; border-radius: 6px; box-sizing: border-box;"><tr><td></td></tr></table>`}
          </td>
          <td valign="middle" align="${textAlign}" style="vertical-align: middle; font-family: ${fontCss}; font-size: ${fontSize}px; line-height: ${lineHeight}; color: ${textColor}; text-align: ${textAlign}; box-sizing: border-box;">
            <div style="font-family: ${fontCss}; font-size: ${fontSize}px; line-height: ${lineHeight}; color: ${textColor}; text-align: ${textAlign}; margin: 0; padding: 0;">
              ${textHtml}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
    }

    default:
      return "";
  }
}

export function compileBlocksToEmailHtml(
  blocks: TemplateBlock[],
  globalSettings?: EmailTemplateGlobalSettings
): string {
  if (!blocks || blocks.length === 0) {
    return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr><td style="padding: 24px 20px; color: #64748b; font-family: sans-serif; font-size: 14px; text-align: center;">(Kein Inhalt hinterlegt)</td></tr>
    </table>`;
  }

  const globalFont = globalSettings?.fontFamily || "sans";
  const outputParts: string[] = [];

  let i = 0;
  while (i < blocks.length) {
    const current = blocks[i];

    // Header block is strictly full-width across 100%
    if (current.type === "header" || current.columnSpan === "full" || !current.columnSpan) {
      outputParts.push(compileSingleBlockHtml(current, globalFont));
      i += 1;
      continue;
    }

    if (current.columnSpan === "third") {
      const next1 = blocks[i + 1];
      const next2 = blocks[i + 2];
      if (next1 && next1.columnSpan === "third" && next2 && next2.columnSpan === "third") {
        const html1 = compileSingleBlockHtml(current, globalFont);
        const html2 = compileSingleBlockHtml(next1, globalFont);
        const html3 = compileSingleBlockHtml(next2, globalFont);
        outputParts.push(`<!-- 3-Column Row -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; table-layout: fixed;">
  <tr>
    <td width="33.33%" valign="top" style="padding-right: 4px; box-sizing: border-box;">
      ${html1}
    </td>
    <td width="33.33%" valign="top" style="padding-left: 2px; padding-right: 2px; box-sizing: border-box;">
      ${html2}
    </td>
    <td width="33.34%" valign="top" style="padding-left: 4px; box-sizing: border-box;">
      ${html3}
    </td>
  </tr>
</table>`);
        i += 3;
        continue;
      } else if (next1 && next1.columnSpan === "third") {
        const html1 = compileSingleBlockHtml(current, globalFont);
        const html2 = compileSingleBlockHtml(next1, globalFont);
        outputParts.push(`<!-- 2-Column Row (from 2 third-span tiles) -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; table-layout: fixed;">
  <tr>
    <td width="50%" valign="top" style="padding-right: 6px; box-sizing: border-box;">
      ${html1}
    </td>
    <td width="50%" valign="top" style="padding-left: 6px; box-sizing: border-box;">
      ${html2}
    </td>
  </tr>
</table>`);
        i += 2;
        continue;
      } else {
        outputParts.push(compileSingleBlockHtml(current, globalFont));
        i += 1;
        continue;
      }
    } else if (current.columnSpan === "half") {
      const next = blocks[i + 1];
      if (next && next.columnSpan === "half") {
        const html1 = compileSingleBlockHtml(current, globalFont);
        const html2 = compileSingleBlockHtml(next, globalFont);
        outputParts.push(`<!-- 2-Column Row (Workday Kacheln) -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; table-layout: fixed;">
  <tr>
    <td width="50%" valign="top" style="padding-right: 6px; box-sizing: border-box;">
      ${html1}
    </td>
    <td width="50%" valign="top" style="padding-left: 6px; box-sizing: border-box;">
      ${html2}
    </td>
  </tr>
</table>`);
        i += 2;
        continue;
      } else {
        const html1 = compileSingleBlockHtml(current, globalFont);
        outputParts.push(`<!-- 2-Column Row (Single Tile) -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; table-layout: fixed;">
  <tr>
    <td width="50%" valign="top" style="padding-right: 6px; box-sizing: border-box;">
      ${html1}
    </td>
    <td width="50%" valign="top" style="padding-left: 6px;">
      &nbsp;
    </td>
  </tr>
</table>`);
        i += 1;
        continue;
      }
    } else {
      outputParts.push(compileSingleBlockHtml(current, globalFont));
      i += 1;
    }
  }

  return outputParts.join("\n\n");
}

/**
 * Creates a unique block ID
 */
export function generateBlockId(): string {
  return "blk_" + Math.random().toString(36).substring(2, 9);
}

/**
 * Automatically and losslessly converts a legacy "header" block into a modern 2-column block
 */
export function migrateHeaderToColumns(block: TemplateBlock): TemplateBlock {
  if (block.type !== "header") return block;
  const cfg = block.config as HeaderBlockConfig;

  const leftBlocks: ColumnChildBlock[] = [
    {
      id: generateBlockId(),
      type: "image",
      config: {
        imageUrl: cfg.logoUrl || "",
        altText: cfg.logoAlt || "Vereins-Logo",
        widthUnit: "%",
        widthValue: 100,
        align: (cfg.textAlign === "right" ? "right" : "left") as "left" | "center" | "right",
        paddingY: 0,
        paddingX: 0,
      } as ImageBlockConfig,
    },
  ];

  const titleText = (cfg.title || "[Vereinsname]").trim();
  const subtitleText = (cfg.subtitle || "").trim();
  const textContent = subtitleText ? `${titleText}\n${subtitleText}` : titleText;

  const rightBlocks: ColumnChildBlock[] = [
    {
      id: generateBlockId(),
      type: "text",
      config: {
        content: textContent,
        fontFamily: cfg.fontFamily || "sans",
        fontSize: cfg.fontSize || 18,
        lineHeight: cfg.lineHeight || 1.3,
        textAlign: cfg.textAlign || "left",
        paddingY: 0,
        paddingX: 0,
        color: cfg.color || "#0f172a",
        backgroundColor: "transparent",
      } as TextBlockConfig,
    },
  ];

  return {
    id: block.id,
    type: "columns",
    columnSpan: "full",
    config: {
      columns: [
        {
          id: generateBlockId(),
          widthPercent: 25,
          blocks: leftBlocks,
        },
        {
          id: generateBlockId(),
          widthPercent: 75,
          blocks: rightBlocks,
        },
      ],
      gap: 16,
      paddingY: cfg.paddingY !== undefined ? cfg.paddingY : 16,
      paddingX: cfg.paddingX !== undefined ? cfg.paddingX : 0,
      backgroundColor: cfg.backgroundColor || "transparent",
      verticalAlign: "middle",
    } as ColumnsBlockConfig,
  };
}

/**
 * Factory for creating a new Multi-Column block (Spalten)
 */
export function createColumnsBlock(
  preset: "50-50" | "25-75" | "33-67" | "75-25" | "33-33-33" | "25-50-25" = "25-75"
): TemplateBlock {
  let columns: ColumnDefinition[];

  if (preset === "25-75") {
    columns = [
      {
        id: generateBlockId(),
        widthPercent: 25,
        blocks: [
          {
            id: generateBlockId(),
            type: "image",
            config: {
              imageUrl: "",
              altText: "Wappen/Logo",
              widthUnit: "%",
              widthValue: 100,
              align: "center",
              paddingY: 0,
              paddingX: 0,
            } as ImageBlockConfig,
          },
        ],
      },
      {
        id: generateBlockId(),
        widthPercent: 75,
        blocks: [
          {
            id: generateBlockId(),
            type: "text",
            config: {
              content: "",
              fontFamily: "sans",
              fontSize: 18,
              lineHeight: 1.3,
              textAlign: "left",
              paddingY: 0,
              paddingX: 0,
              color: "#0f172a",
              backgroundColor: "transparent",
            } as TextBlockConfig,
          },
        ],
      },
    ];
  } else if (preset === "33-33-33") {
    columns = [
      {
        id: generateBlockId(),
        widthPercent: 33.33,
        blocks: [
          {
            id: generateBlockId(),
            type: "text",
            config: {
              content: "Spalte 1",
              fontSize: 14,
              lineHeight: 1.5,
              paddingY: 8,
              paddingX: 8,
              color: "#334155",
            } as TextBlockConfig,
          },
        ],
      },
      {
        id: generateBlockId(),
        widthPercent: 33.33,
        blocks: [
          {
            id: generateBlockId(),
            type: "text",
            config: {
              content: "Spalte 2",
              fontSize: 14,
              lineHeight: 1.5,
              paddingY: 8,
              paddingX: 8,
              color: "#334155",
            } as TextBlockConfig,
          },
        ],
      },
      {
        id: generateBlockId(),
        widthPercent: 33.34,
        blocks: [
          {
            id: generateBlockId(),
            type: "text",
            config: {
              content: "Spalte 3",
              fontSize: 14,
              lineHeight: 1.5,
              paddingY: 8,
              paddingX: 8,
              color: "#334155",
            } as TextBlockConfig,
          },
        ],
      },
    ];
  } else if (preset === "25-50-25") {
    columns = [
      {
        id: generateBlockId(),
        widthPercent: 25,
        blocks: [
          {
            id: generateBlockId(),
            type: "text",
            config: { content: "Spalte 1", fontSize: 14, paddingY: 8, paddingX: 8, color: "#334155" } as TextBlockConfig,
          },
        ],
      },
      {
        id: generateBlockId(),
        widthPercent: 50,
        blocks: [
          {
            id: generateBlockId(),
            type: "text",
            config: { content: "Spalte 2", fontSize: 14, paddingY: 8, paddingX: 8, color: "#334155" } as TextBlockConfig,
          },
        ],
      },
      {
        id: generateBlockId(),
        widthPercent: 25,
        blocks: [
          {
            id: generateBlockId(),
            type: "text",
            config: { content: "Spalte 3", fontSize: 14, paddingY: 8, paddingX: 8, color: "#334155" } as TextBlockConfig,
          },
        ],
      },
    ];
  } else {
    // 50-50, 33-67, 75-25
    const w1 = preset === "33-67" ? 33.33 : preset === "75-25" ? 75 : 50;
    const w2 = preset === "33-67" ? 66.67 : preset === "75-25" ? 25 : 50;
    columns = [
      {
        id: generateBlockId(),
        widthPercent: w1,
        blocks: [
          {
            id: generateBlockId(),
            type: "text",
            config: {
              content: "Spalte links...",
              fontSize: 14,
              lineHeight: 1.5,
              paddingY: 8,
              paddingX: 8,
              color: "#334155",
            } as TextBlockConfig,
          },
        ],
      },
      {
        id: generateBlockId(),
        widthPercent: w2,
        blocks: [
          {
            id: generateBlockId(),
            type: "text",
            config: {
              content: "Spalte rechts...",
              fontSize: 14,
              lineHeight: 1.5,
              paddingY: 8,
              paddingX: 8,
              color: "#334155",
            } as TextBlockConfig,
          },
        ],
      },
    ];
  }

  return {
    id: generateBlockId(),
    type: "columns",
    columnSpan: "full",
    config: {
      columns,
      gap: 0,
      paddingY: 12,
      paddingX: 0,
      backgroundColor: "transparent",
      verticalAlign: "middle",
    } as ColumnsBlockConfig,
  };
}

/**
 * Factory for creating a new Header block (Kopfzeile)
 * 2-Spalten-Layout: Quadratisches Logo links, frei formatierbarer Text rechts (vertikal zentriert, 16px Gap)
 */
export function createHeaderBlock(
  initialText?: string,
  initialLogoUrl?: string
): TemplateBlock {
  return {
    id: generateBlockId(),
    type: "header",
    columnSpan: "full",
    config: {
      logoUrl: initialLogoUrl || "",
      logoAlt: "Wappen/Logo",
      logoWidth: 72,
      textContent: initialText || "",
      fontFamily: "system-sans",
      fontSize: 18,
      lineHeight: 1.4,
      textAlign: "left",
      textColor: "#0f172a",
      paddingY: 16,
      paddingX: 0,
      backgroundColor: "transparent",
    } as HeaderBlockConfig,
  };
}

/**
 * Factory for creating a new Text block
 */
export function createTextBlock(initialContent?: string, columnSpan: "full" | "half" | "third" = "full"): TemplateBlock {
  return {
    id: generateBlockId(),
    type: "text",
    columnSpan,
    config: {
      content:
        initialContent ||
        "Hallo [Spieler-Name],\n\nhier ist eine wichtige Benachrichtigung zu deiner Buchung auf [Platz-Bezeichnung] am [Datum].",
      fontFamily: "sans",
      fontSize: 15,
      lineHeight: 1.6,
      textAlign: "left",
      paddingY: 12,
      paddingX: 20,
      color: "#334155",
      backgroundColor: "transparent",
    } as TextBlockConfig,
  };
}

/**
 * Factory for creating a new Button block
 */
export function createButtonBlock(initialLabel?: string, columnSpan: "full" | "half" | "third" = "full"): TemplateBlock {
  return {
    id: generateBlockId(),
    type: "button",
    columnSpan,
    config: {
      label: initialLabel || "Buchung verwalten oder stornieren",
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
    } as ButtonBlockConfig,
  };
}

/**
 * Factory for creating a new Image block
 */
export function createImageBlock(imageUrl?: string, columnSpan: "full" | "half" | "third" = "full"): TemplateBlock {
  return {
    id: generateBlockId(),
    type: "image",
    columnSpan,
    config: {
      imageUrl: imageUrl || "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&auto=format&fit=crop&q=80",
      altText: "Tennis Club Banner",
      widthUnit: "%",
      widthValue: 100,
      align: "center",
      targetUrl: "",
      paddingY: 12,
      paddingX: 0,
    } as ImageBlockConfig,
  };
}
