/**
 * Enterprise-grade, table-based, responsive HTML/CSS email wrapper.
 * Compatible with Gmail, Apple Mail, Outlook (MSO), Yahoo, and mobile clients.
 */

export interface EmailWrapperOptions {
  title?: string;
  clubName?: string;
  logoUrl?: string;
  primaryColor?: string;
  footerText?: string;
}

/**
 * Returns the complete HTML document containing the fixed corporate email layout
 * with the `{{{content}}}` Handlebars raw interpolation tag.
 */
export function getEmailLayoutWrapper(options: EmailWrapperOptions = {}): string {
  const clubName = options.clubName || "Tennis-Club e.V.";
  const primaryColor = options.primaryColor || "#047857"; // Emerald 700
  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>{{title}}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; min-width: 100%; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .content-padding { padding: 24px 16px !important; }
      .header-padding { padding: 20px 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; -webkit-font-smoothing: antialiased;">
  <!-- Preheader text hidden in inbox preview -->
  <div style="display: none; font-size: 1px; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    {{title}} &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 28px 12px;">
        <!-- Container max-width 600px -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" class="email-container" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, ${primaryColor} 0%, #064e3b 100%); padding: 26px 32px; text-align: left;" class="header-padding">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td valign="middle">
                    <!-- Brand Icon & Name -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color: rgba(255, 255, 255, 0.18); border-radius: 8px; width: 38px; height: 38px; text-align: center; vertical-align: middle;">
                          <span style="font-size: 20px; line-height: 20px;">🎾</span>
                        </td>
                        <td style="padding-left: 12px;">
                          <div style="font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: -0.2px; line-height: 22px;">
                            ${clubName}
                          </div>
                          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: rgba(255, 255, 255, 0.78); letter-spacing: 0.8px; margin-top: 2px;">
                            Platzreservierung & Benachrichtigungen
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 36px 32px; background-color: #ffffff; color: #334155; font-size: 15px; line-height: 24px;" class="content-padding">
              {{{content}}}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 32px;">
              <div style="border-top: 1px solid #f1f5f9; height: 1px; width: 100%;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f8fafc; text-align: center; color: #64748b; font-size: 12px; line-height: 18px;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">
                ${clubName} &bull; Online-Buchungssystem
              </p>
              <p style="margin: 0 0 8px 0; color: #94a3b8; font-size: 11px;">
                Diese E-Mail wurde automatisch aus dem Buchungsportal versendet. Bitte antworte nicht direkt auf diese Nachricht.
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                &copy; ${currentYear} ${clubName}. Alle Rechte vorbehalten.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
