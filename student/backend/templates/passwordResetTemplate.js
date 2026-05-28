'use strict';

/**
 * Password-reset email.
 *
 * @param {object} p
 * @param {string} p.studentName   - Full name of the student
 * @param {string} p.resetUrl      - Full URL with token embedded (expires in expiresInHours)
 * @param {number} [p.expiresInHours] - Token validity (default: 1)
 */
module.exports = function passwordResetTemplate({
  studentName,
  resetUrl,
  expiresInHours = 1,
}) {
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Reset Your Password — Periyar University PhD Portal</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Tahoma,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Preheader -->
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    Password reset requested for your Periyar University PhD Portal account. Link expires in ${expiresInHours} hour${expiresInHours !== 1 ? 's' : ''}. &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </span>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#eef2f7;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Outer card -->
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;
                      overflow:hidden;box-shadow:0 8px 32px rgba(15,76,129,0.12);">

          <!-- ── Header ── -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f4c81 0%,#1565a8 60%,#0d3d6e 100%);
                        padding:36px 40px 32px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.18);border-radius:50%;
                          width:72px;height:72px;line-height:72px;text-align:center;
                          border:2px solid rgba(255,255,255,0.3);margin-bottom:16px;">
                <span style="color:#ffffff;font-size:26px;font-weight:800;
                             letter-spacing:-1px;vertical-align:middle;">PU</span>
              </div>
              <h1 style="margin:0 0 4px;color:#ffffff;font-size:20px;font-weight:800;
                          letter-spacing:2px;text-transform:uppercase;">
                PERIYAR UNIVERSITY
              </h1>
              <p style="margin:0 0 2px;color:rgba(255,255,255,0.75);font-size:12px;font-style:italic;">
                பெரியார் பல்கலைக்கழகம்
              </p>
              <p style="margin:0;color:rgba(255,255,255,0.65);font-size:12px;">
                Salem – 636 011, Tamil Nadu, India
              </p>
            </td>
          </tr>

          <!-- Red accent strip -->
          <tr><td style="background:linear-gradient(90deg,#901a1e,#c0392b);height:4px;"></td></tr>

          <!-- ── Body ── -->
          <tr>
            <td style="padding:40px 44px 36px;">

              <!-- Lock icon circle -->
              <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-block;background:#f0f7ff;border-radius:50%;
                            width:64px;height:64px;line-height:64px;text-align:center;">
                  <span style="font-size:28px;vertical-align:middle;">🔑</span>
                </div>
              </div>

              <h2 style="margin:0 0 6px;color:#0f4c81;font-size:22px;font-weight:800;text-align:center;">
                Password Reset Request
              </h2>
              <p style="margin:0 0 28px;color:#4b5563;font-size:15px;line-height:1.7;text-align:center;">
                Hello <strong>${studentName}</strong>, we received a request to reset the password for
                your PhD Admission Portal account.
              </p>

              <!-- Expiry notice -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;
                              padding:12px 18px;margin-bottom:24px;">
                    <p style="margin:0;color:#92400e;font-size:12px;text-align:center;">
                      ⏱ This link expires in <strong>${expiresInHours} hour${expiresInHours !== 1 ? 's' : ''}</strong>.
                      After that you will need to request a new reset link.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-top:24px;">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
                      href="${resetUrl}" style="height:48px;v-text-anchor:middle;width:260px;"
                      arcsize="17%" fillcolor="#0f4c81" stroke="f">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-size:15px;font-weight:700;">
                        Reset My Password →
                      </center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${resetUrl}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-block;background:linear-gradient(135deg,#0f4c81,#1565a8);
                              color:#ffffff;text-decoration:none;padding:14px 48px;
                              border-radius:8px;font-size:15px;font-weight:700;
                              letter-spacing:0.3px;mso-hide:all;">
                      Reset My Password &rarr;
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0 0 24px;color:#6b7280;font-size:12px;text-align:center;line-height:1.7;">
                If the button doesn't work, copy and paste this link into your browser:<br />
                <a href="${resetUrl}" style="color:#0f4c81;word-break:break-all;">${resetUrl}</a>
              </p>

              <!-- Security notice -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;
                              padding:14px 18px;">
                    <p style="margin:0;color:#9f1239;font-size:12px;line-height:1.7;">
                      <strong>🔒 Didn't request this?</strong> If you did not request a password reset,
                      ignore this email — your account remains secure. Contact us at
                      <a href="mailto:support@periyaruniversity.ac.in"
                         style="color:#9f1239;">support@periyaruniversity.ac.in</a>
                      if you have concerns.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;
                        padding:24px 44px;text-align:center;">
              <p style="margin:0 0 4px;color:#901a1e;font-size:12px;font-weight:700;
                         letter-spacing:1px;text-transform:uppercase;">
                Periyar University — PhD Admission Portal
              </p>
              <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.7;">
                Periyar Palkalai Nagar, Salem – 636 011, Tamil Nadu, India<br />
                &copy; ${year} Periyar University. All rights reserved.<br />
                This is an automated message — please do not reply directly.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
};
