'use strict';

/**
 * Welcome email sent immediately after student registration.
 *
 * @param {object} p
 * @param {string} p.studentName    - Full name of the student
 * @param {string} p.applicationId  - Generated application reference (e.g. APP2026-000001)
 * @param {string} p.loginUrl       - Link to the student portal login page
 * @param {string} [p.email]        - Student's email address (shown in portal note)
 */
module.exports = function welcomeTemplate({ studentName, applicationId, loginUrl, email = '' }) {
  const year = new Date().getFullYear();

  const steps = [
    {
      num: '01',
      title: 'Login to Your Portal',
      desc:  'Use your registered email and the password you created during signup to access the PhD Admission Portal.',
    },
    {
      num: '02',
      title: 'Complete Your Application',
      desc:  'Fill in all sections: personal details, academic qualifications, and upload required documents.',
    },
    {
      num: '03',
      title: 'Review & Submit',
      desc:  'Carefully review every section, accept the declaration, and submit before the session deadline.',
    },
  ];

  const stepsHtml = steps.map(s => `
    <tr>
      <td style="padding:0 0 20px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td width="44" valign="top" style="padding-top:2px;">
              <div style="background:#0f4c81;color:#ffffff;width:30px;height:30px;border-radius:50%;
                          text-align:center;line-height:30px;font-size:11px;font-weight:700;">
                ${s.num}
              </div>
            </td>
            <td valign="top">
              <p style="margin:0 0 3px;color:#1a1a2e;font-size:14px;font-weight:700;">${s.title}</p>
              <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">${s.desc}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Welcome to Periyar University PhD Portal</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Tahoma,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Preheader (hidden preview text) -->
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    Welcome! Your application ${applicationId} is ready. Login to begin your PhD journey. &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
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
              <!-- Logo circle -->
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
              <p style="margin:0 0 2px;color:rgba(255,255,255,0.75);font-size:12px;
                         font-style:italic;">பெரியார் பல்கலைக்கழகம்</p>
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

              <h2 style="margin:0 0 6px;color:#0f4c81;font-size:26px;font-weight:800;">
                Welcome, ${studentName}! 🎓
              </h2>
              <p style="margin:0 0 28px;color:#4b5563;font-size:15px;line-height:1.7;">
                Congratulations on registering for the <strong>PhD Admission Programme</strong>.
                Your applicant account has been created and a draft application is ready for you to complete.
              </p>

              <!-- Application ID card -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:linear-gradient(135deg,#f0f7ff,#e8f0fe);
                              border:1.5px solid #b8d0f0;border-radius:12px;
                              padding:20px 24px;text-align:center;">
                    <p style="margin:0 0 6px;color:#0f4c81;font-size:11px;font-weight:700;
                               text-transform:uppercase;letter-spacing:2px;">
                      Application Reference Number
                    </p>
                    <p style="margin:0 0 6px;color:#0f4c81;font-size:30px;font-weight:900;
                               letter-spacing:3px;font-family:'Courier New',monospace;">
                      ${applicationId}
                    </p>
                    <p style="margin:0;color:#6b7280;font-size:12px;">
                      Save this number — it is needed for all correspondence with the university.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Steps -->
              <h3 style="margin:32px 0 20px;color:#1a1a2e;font-size:15px;font-weight:700;
                          border-bottom:2px solid #f3f4f6;padding-bottom:10px;">
                Your Next Steps
              </h3>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                ${stepsHtml}
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-top:8px;">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
                      href="${loginUrl}" style="height:48px;v-text-anchor:middle;width:240px;"
                      arcsize="17%" fillcolor="#0f4c81" stroke="f">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-size:15px;font-weight:700;">
                        Login to Your Portal →
                      </center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${loginUrl}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-block;background:linear-gradient(135deg,#0f4c81,#1565a8);
                              color:#ffffff;text-decoration:none;padding:14px 44px;
                              border-radius:8px;font-size:15px;font-weight:700;
                              letter-spacing:0.3px;mso-hide:all;">
                      Login to Your Portal &rarr;
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Security notice -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;
                              padding:14px 18px;">
                    <p style="margin:0;color:#92400e;font-size:12px;line-height:1.6;">
                      <strong>🔒 Security Notice:</strong> Periyar University will never ask for your
                      password via email. If you did not create this account, please contact us
                      immediately at
                      <a href="mailto:support@periyaruniversity.ac.in"
                         style="color:#92400e;">support@periyaruniversity.ac.in</a>.
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
