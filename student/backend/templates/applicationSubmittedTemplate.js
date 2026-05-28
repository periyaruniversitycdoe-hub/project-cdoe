'use strict';

/**
 * Confirmation email sent when a student successfully submits their application.
 *
 * @param {object} p
 * @param {string} p.studentName     - Full name of the student
 * @param {string} p.applicationId   - Application reference (e.g. APP2026-000001)
 * @param {string} p.department      - Applied department / subject
 * @param {string} [p.submittedAt]   - ISO date-string of submission (defaults to now)
 * @param {string} [p.portalUrl]     - Link to the student portal
 */
module.exports = function applicationSubmittedTemplate({
  studentName,
  applicationId,
  department,
  submittedAt,
  portalUrl = 'http://localhost:5173',
}) {
  const year = new Date().getFullYear();
  const submittedDate = submittedAt
    ? new Date(submittedAt).toLocaleString('en-IN', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : new Date().toLocaleString('en-IN', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      });

  const nextSteps = [
    {
      num: '01',
      title: 'Application Review',
      desc:  'The university will review your submitted documents and application details.',
    },
    {
      num: '02',
      title: 'Entrance Examination',
      desc:  'Eligible candidates will receive hall tickets for the PhD entrance examination.',
    },
    {
      num: '03',
      title: 'Result & Counselling',
      desc:  'Qualified candidates proceed to counselling and department allocation.',
    },
  ];

  const stepsHtml = nextSteps.map(s => `
    <tr>
      <td style="padding:0 0 18px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td width="44" valign="top" style="padding-top:2px;">
              <div style="background:#10b981;color:#ffffff;width:30px;height:30px;border-radius:50%;
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
  <title>Application Submitted — Periyar University PhD Portal</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Tahoma,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Preheader -->
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    Application ${applicationId} submitted successfully. We will be in touch about next steps. &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
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

          <!-- Green accent strip (success colour) -->
          <tr><td style="background:linear-gradient(90deg,#059669,#10b981);height:4px;"></td></tr>

          <!-- ── Body ── -->
          <tr>
            <td style="padding:40px 44px 36px;">

              <!-- Success icon -->
              <div style="text-align:center;margin-bottom:20px;">
                <div style="display:inline-block;background:#d1fae5;border-radius:50%;
                            width:64px;height:64px;line-height:64px;text-align:center;">
                  <span style="font-size:30px;vertical-align:middle;">✅</span>
                </div>
              </div>

              <h2 style="margin:0 0 6px;color:#065f46;font-size:22px;font-weight:800;text-align:center;">
                Application Submitted!
              </h2>
              <p style="margin:0 0 28px;color:#4b5563;font-size:15px;line-height:1.7;text-align:center;">
                Dear <strong>${studentName}</strong>, your PhD application has been successfully submitted.
                A university representative will review it and notify you of the outcome.
              </p>

              <!-- Application details card -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);
                              border:1.5px solid #86efac;border-radius:12px;
                              padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td width="50%" style="padding-bottom:12px;">
                          <p style="margin:0 0 3px;color:#065f46;font-size:10px;font-weight:700;
                                     text-transform:uppercase;letter-spacing:1.5px;">Application ID</p>
                          <p style="margin:0;color:#0f4c81;font-size:16px;font-weight:900;
                                     font-family:'Courier New',monospace;letter-spacing:1px;">
                            ${applicationId}
                          </p>
                        </td>
                        <td width="50%" style="padding-bottom:12px;text-align:right;">
                          <p style="margin:0 0 3px;color:#065f46;font-size:10px;font-weight:700;
                                     text-transform:uppercase;letter-spacing:1.5px;">Status</p>
                          <p style="margin:0;">
                            <span style="background:#10b981;color:#ffffff;font-size:11px;font-weight:700;
                                          padding:3px 10px;border-radius:20px;">SUBMITTED</span>
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:0;">
                          <p style="margin:0 0 3px;color:#065f46;font-size:10px;font-weight:700;
                                     text-transform:uppercase;letter-spacing:1.5px;">Department</p>
                          <p style="margin:0;color:#1a1a2e;font-size:14px;font-weight:600;">
                            ${department || '—'}
                          </p>
                        </td>
                        <td style="padding-bottom:0;text-align:right;">
                          <p style="margin:0 0 3px;color:#065f46;font-size:10px;font-weight:700;
                                     text-transform:uppercase;letter-spacing:1.5px;">Submitted On</p>
                          <p style="margin:0;color:#1a1a2e;font-size:12px;">${submittedDate}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- What happens next -->
              <h3 style="margin:32px 0 20px;color:#1a1a2e;font-size:15px;font-weight:700;
                          border-bottom:2px solid #f3f4f6;padding-bottom:10px;">
                What Happens Next?
              </h3>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                ${stepsHtml}
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-top:8px;">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
                      href="${portalUrl}" style="height:48px;v-text-anchor:middle;width:240px;"
                      arcsize="17%" fillcolor="#0f4c81" stroke="f">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-size:15px;font-weight:700;">
                        View My Application →
                      </center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${portalUrl}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-block;background:linear-gradient(135deg,#0f4c81,#1565a8);
                              color:#ffffff;text-decoration:none;padding:14px 44px;
                              border-radius:8px;font-size:15px;font-weight:700;
                              letter-spacing:0.3px;mso-hide:all;">
                      View My Application &rarr;
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Keep safe notice -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;
                              padding:14px 18px;">
                    <p style="margin:0;color:#92400e;font-size:12px;line-height:1.6;">
                      <strong>📋 Keep this email safe.</strong> Your application ID
                      <strong>${applicationId}</strong> is required for all official
                      correspondence with the university.
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
