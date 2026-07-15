"use strict";
/**
 * Shared, brand-consistent email layout (header + body + footer).
 *
 * This is intentionally a single reusable shell so every application renders
 * the same header banner, container styling and RFCx footer. Individual
 * templates only produce the inner body markup and hand it to `renderLayout`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FROM = void 0;
exports.renderLayout = renderLayout;
const HEADER_IMG = 'https://static.rfcx.org/img/email/header.jpg';
const SOCIAL_LINKS = [
    { href: 'https://www.facebook.com/RainforestCx/', img: 'https://static.rfcx.org/img/email/facebook.png' },
    { href: 'https://twitter.com/rainforestcx', img: 'https://static.rfcx.org/img/email/twitter.png' },
    { href: 'https://www.flickr.com/photos/rainforestcx/', img: 'https://static.rfcx.org/img/email/flickr.png' },
    { href: 'https://www.instagram.com/rainforestcx/', img: 'https://static.rfcx.org/img/email/instagram.png' },
    { href: 'https://www.youtube.com/user/RfcxOrg', img: 'https://static.rfcx.org/img/email/youtube.png' }
];
function socialCell(href, img) {
    return `<td valign="center" align="center" class="center">
                    <a href="${href}" class="footer__social-link" target="_blank">
                      <img src="${img}" width="16" alt="RFCx" border="0" style="-ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;"/>
                    </a>
                  </td>`;
}
function renderLayout(options) {
    const { bodyHtml, footer = true, header = true } = options;
    const social = SOCIAL_LINKS.map(({ href, img }) => socialCell(href, img)).join('\n                  ');
    const headerHtml = header
        ? `      <table cellpadding="0" cellspacing="0" width="100%" align="center" border="0" style='width: 600px; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; mso-table-lspace: 0pt; mso-table-rspace: 0pt; margin: 0;
          padding: 0; font-family: "Lato", sans-serif; border-collapse: collapse !important;'>
        <thead>
          <tr>
            <td style="padding: 0px;" align="center" valign="top">
                <a style="display: block;" href="https://rfcx.org/">
                  <img src="${HEADER_IMG}" width="600" alt="RFCx" border="0" style="-ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;"/>
                </a>
            </td>
          </tr>
        </thead>
      </table>`
        : '';
    const footerHtml = footer
        ? `      <table cellpadding="0" cellspacing="0" width="100%" align="center" border="0" bgcolor="#ffffff" style='width: 600px; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; mso-table-lspace: 0pt; mso-table-rspace: 0pt; margin: 0;
        padding: 0; font-family: "Lato", sans-serif; border-collapse: collapse !important;'>
        <tfoot>
          <tr>
            <td valign="top" class="center" style="padding: 10px 0 10px;">
              <hr style="border: 1px solid #828282; border-bottom: 0; margin: 0px;" />
            </td>
          </tr>
          <tr>
            <td valign="top" class="center" style='padding: 10px 10px; text-align: center; font-family: "Lato", sans-serif; font-size: 12px; color: #828282'>
              Rainforest Connection is a 501<sub>(c)(3)</sub>
            </td>
          </tr>
          <tr>
            <td valign="top" class="center" style='padding: 15px 0;'>
              <table cellpadding="0" cellspacing="0" width="200px" align="center" border="0" bgcolor="#ffffff">
                <tr>
                  ${social}
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td valign="top" class="center" style='padding: 10px 10px 20px; text-align: center; font-family: "Lato", sans-serif; font-size: 12px; color: #828282'>
              77 Van Ness Ave, Suite 101-1717, San Francisco, CA, 94102, USA, +1 (415) 335-9205
            </td>
          </tr>
        </tfoot>
      </table>`
        : '';
    return `<html>
  <head>
    <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet">
    <style type="text/css">.ExternalClass,.ExternalClass div,.ExternalClass font,.ExternalClass p,.ExternalClass span,.ExternalClass td,img{line-height:100%}#outlook a{padding:0}.ExternalClass,.ReadMsgBody{width:100%}a,blockquote,body,li,p,table,td{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table,td{mso-table-lspace:0;mso-table-rspace:0}img{-ms-interpolation-mode:bicubic;border:0;height:auto;outline:0;text-decoration:none}table{border-collapse:collapse!important}#bodyCell,#bodyTable,body{margin:0;padding:0;font-family:Lato,sans-serif;color:#000}#bodyCell{padding:20px}#bodyTable{width:600px}.im{color:#000!important}@media only screen and (max-width:480px){a,blockquote,body,li,p,table,td{-webkit-text-size-adjust:none!important}body{min-width:100%!important}#bodyTable{max-width:600px!important}#signIn{max-width:280px!important}}@media only screen and (max-width:640px){body[yahoo] .deviceWidth{width:440px!important}body[yahoo] .center{text-align:center!important}}@media only screen and (max-width:479px){body[yahoo] .deviceWidth{width:280px!important}body[yahoo] .center{text-align:center!important}}</style>
  </head>
  <body>
    <center>
${headerHtml}
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" id="bodyTable" bgcolor="#ffffff"
        style='width: 600px; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; mso-table-lspace: 0pt; mso-table-rspace: 0pt;
                margin: 0; padding: 0; font-family: "Lato", sans-serif; border-collapse: collapse !important;'>
        <tr>
          <td align="center" valign="top" id="bodyCell">
            <div class="main">
${bodyHtml}
            </div>
          </td>
        </tr>
      </table>
${footerHtml}
    </center>
  </body>
</html>`;
}
exports.DEFAULT_FROM = {
    rfcx: { email: 'contact@rfcx.org', name: 'Rainforest Connection' },
    arbimon: { email: 'no-reply@arbimon.org', name: 'Arbimon' }
};
