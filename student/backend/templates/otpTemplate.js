'use strict';

/**
 * OTP email — sent for login/email verification flows.
 *
 * @param {object} p
 * @param {string} p.studentName       - Full name of the student
 * @param {string} p.otp               - 6-digit OTP code
 * @param {string} [p.purpose]         - 'verification' | 'login' | 'reset'  (default: 'verification')
 * @param {number} [p.expiresInMinutes] - Validity window shown to user (default: 10)
 */
module.exports = function otpTemplate({
  studentName,
  otp,
  purpose = 'verification',
  expiresInMinutes = 10,
}) {
  const year = new Date().getFullYear();

  const purposeMap = {
    verification: { label: 'Email Verification',  action: 'verify your email address' },
    login:        { label: 'Login Verification',   action: 'complete your login'        },
    reset:        { label: 'Password Reset',        action: 'reset your password'        },
  };
  const { label, action } = purposeMap[purpose] || purposeMap.verification;

  // Split the 6-digit OTP into individual digit cells for the styled display
  const digits = String(otp).padStart(6, '0').split('');
  const digitCells = digits.map(d => `
      <td style="width:44px;height:52px;text-align:center;vertical-align:middle;
                 background:#0f4c81;border-radius:8px;
                 font-size:26px;font-weight:900;color:#ffffff;
                 font-family:'Courier New',monospace;letter-spacing:0;
                 padding:0 6px;">
        ${d}
      </td>
      <td style="width:8px;"></td>`).join('');

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${label} — Periyar University PhD Portal</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Tahoma,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Preheader -->
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    Your ${label} OTP is ${otp} — valid for ${expiresInMinutes} minutes. Do not share this code. &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
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

              <h2 style="margin:0 0 6px;color:#0f4c81;font-size:22px;font-weight:800;">
                ${label}
              </h2>
              <p style="margin:0 0 28px;color:#4b5563;font-size:15px;line-height:1.7;">
                Hello <strong>${studentName}</strong>, use the one-time code below to ${action}.
                This code is valid for <strong>${expiresInMinutes} minutes</strong> and can be used only once.
              </p>

              <!-- OTP digits -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 28px;">
                <tr>
                  ${digitCells}
                </tr>
              </table>

              <!-- Copy-friendly fallback (plain text code) -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:#f0f7ff;border:1.5px dashed #b8d0f0;border-radius:10px;
                              padding:14px 20px;text-align:center;">
                    <p style="margin:0 0 4px;color:#6b7280;font-size:11px;text-transform:uppercase;
                               letter-spacing:1.5px;">Your OTP Code</p>
                    <p style="margin:0;color:#0f4c81;font-size:32px;font-weight:900;
                               letter-spacing:8px;font-family:'Courier New',monospace;">
                      ${otp}
                    </p>
                    <p style="margin:6px 0 0;color:#9ca3af;font-size:11px;">
                      Expires in ${expiresInMinutes} minutes
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:24px;">
                <tr>
                  <td style="background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;padding:14px 18px;">
                    <p style="margin:0;color:#9f1239;font-size:12px;line-height:1.7;">
                      <strong>⚠️ Never share this code.</strong> Periyar University staff will never ask
                      for your OTP. If you did not request this code, please ignore this email or contact
                      <a href="mailto:support@periyaruniversity.ac.in"
                         style="color:#9f1239;">support@periyaruniversity.ac.in</a> immediately.
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
