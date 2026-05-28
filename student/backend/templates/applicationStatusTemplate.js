'use strict';

/**
 * Multi-purpose status-update email for application lifecycle events.
 *
 * Supported statusType values:
 *   'approved'          — Application approved
 *   'rejected'          — Application rejected
 *   'payment_confirmed' — Payment recorded / receipt issued
 *   'hall_ticket'       — Hall ticket is ready for download
 *
 * @param {object} p
 * @param {string} p.studentName     - Full name of the student
 * @param {string} p.applicationId   - Application reference
 * @param {string} p.statusType      - One of the values above
 * @param {string} [p.department]    - Department / subject applied for
 * @param {string} [p.message]       - Optional admin note / reason shown to student
 * @param {string} [p.actionUrl]     - CTA link (portal or payment page)
 * @param {string} [p.actionLabel]   - CTA button text (overrides default)
 * @param {string} [p.amount]        - Payment amount string (e.g. '₹1,500')
 * @param {string} [p.transactionId] - Payment transaction / reference ID
 */
module.exports = function applicationStatusTemplate({
  studentName,
  applicationId,
  statusType,
  department,
  message,
  actionUrl = 'http://localhost:5173',
  actionLabel,
  amount,
  transactionId,
}) {
  const year = new Date().getFullYear();

  // ── Status-specific config ────────────────────────────────────────────────
  const configs = {
    approved: {
      accentColor:  '#10b981',
      accentGrad:   'linear-gradient(90deg,#059669,#10b981)',
      badgeColor:   '#10b981',
      badgeBg:      '#d1fae5',
      badgeText:    'APPROVED',
      icon:         '🎉',
      iconBg:       '#d1fae5',
      heading:      'Application Approved!',
      headingColor: '#065f46',
      intro:        `Congratulations! Your PhD application has been reviewed and <strong>approved</strong>
                     by the admissions committee. Proceed to the next steps on your portal.`,
      ctaLabel:     'Go to My Portal',
    },
    rejected: {
      accentColor:  '#ef4444',
      accentGrad:   'linear-gradient(90deg,#b91c1c,#ef4444)',
      badgeColor:   '#ef4444',
      badgeBg:      '#fee2e2',
      badgeText:    'NOT SELECTED',
      icon:         '📋',
      iconBg:       '#fee2e2',
      heading:      'Application Status Update',
      headingColor: '#7f1d1d',
      intro:        `Dear <strong>${studentName}</strong>, after careful review, we regret to inform you
                     that your application was not selected in this round. You may re-apply in the next session.`,
      ctaLabel:     'Visit Portal',
    },
    payment_confirmed: {
      accentColor:  '#0f4c81',
      accentGrad:   'linear-gradient(90deg,#0f4c81,#1565a8)',
      badgeColor:   '#0f4c81',
      badgeBg:      '#dbeafe',
      badgeText:    'PAYMENT CONFIRMED',
      icon:         '💳',
      iconBg:       '#dbeafe',
      heading:      'Payment Confirmed',
      headingColor: '#0f4c81',
      intro:        `Your payment has been successfully recorded. Below are your payment details for reference.`,
      ctaLabel:     'View Dashboard',
    },
    hall_ticket: {
      accentColor:  '#7c3aed',
      accentGrad:   'linear-gradient(90deg,#5b21b6,#7c3aed)',
      badgeColor:   '#7c3aed',
      badgeBg:      '#ede9fe',
      badgeText:    'HALL TICKET READY',
      icon:         '🎫',
      iconBg:       '#ede9fe',
      heading:      'Your Hall Ticket is Ready',
      headingColor: '#4c1d95',
      intro:        `Your entrance examination hall ticket has been issued. Please download it from the
                     portal and bring a printed copy on the day of the examination.`,
      ctaLabel:     'Download Hall Ticket',
    },
  };

  const cfg = configs[statusType] || configs.approved;
  const ctaLabel = actionLabel || cfg.ctaLabel;

  // ── Payment detail rows (only for payment_confirmed) ──────────────────────
  const paymentRows = statusType === 'payment_confirmed' ? `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:20px;">
      <tr>
        <td style="background:#f0f7ff;border:1.5px solid #b8d0f0;border-radius:10px;padding:18px 22px;">
          ${amount ? `
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="padding-bottom:10px;">
                <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Amount Paid</span><br />
                <span style="color:#0f4c81;font-size:22px;font-weight:900;">${amount}</span>
              </td>
              ${transactionId ? `
              <td style="padding-bottom:10px;text-align:right;">
                <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Transaction ID</span><br />
                <span style="color:#1a1a2e;font-size:14px;font-weight:700;font-family:'Courier New',monospace;">
                  ${transactionId}
                </span>
              </td>` : ''}
            </tr>
          </table>` : ''}
          <p style="margin:0;color:#6b7280;font-size:11px;">
            Keep this confirmation for your records. Contact us if you have any payment queries.
          </p>
        </td>
      </tr>
    </table>` : '';

  // ── Custom message box (admin note / reason) ──────────────────────────────
  const messageBox = message ? `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:20px;">
      <tr>
        <td style="background:#f9fafb;border-left:4px solid ${cfg.accentColor};border-radius:0 8px 8px 0;
                    padding:14px 18px;">
          <p style="margin:0 0 4px;color:#374151;font-size:12px;font-weight:700;text-transform:uppercase;
                     letter-spacing:1px;">Note from the University</p>
          <p style="margin:0;color:#4b5563;font-size:13px;line-height:1.7;">${message}</p>
        </td>
      </tr>
    </table>` : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${cfg.heading} — Periyar University PhD Portal</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Tahoma,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Preheader -->
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    Application ${applicationId} — ${cfg.badgeText}. Login to your portal for details. &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
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

          <!-- Status-coloured accent strip -->
          <tr><td style="background:${cfg.accentGrad};height:4px;"></td></tr>

          <!-- ── Body ── -->
          <tr>
            <td style="padding:40px 44px 36px;">

              <!-- Status icon -->
              <div style="text-align:center;margin-bottom:20px;">
                <div style="display:inline-block;background:${cfg.iconBg};border-radius:50%;
                            width:64px;height:64px;line-height:64px;text-align:center;">
                  <span style="font-size:28px;vertical-align:middle;">${cfg.icon}</span>
                </div>
              </div>

              <h2 style="margin:0 0 6px;color:${cfg.headingColor};font-size:22px;font-weight:800;text-align:center;">
                ${cfg.heading}
              </h2>
              <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.7;text-align:center;">
                Dear <strong>${studentName}</strong>,<br />
                ${cfg.intro}
              </p>

              <!-- Application reference card -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;
                              padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td>
                          <p style="margin:0 0 3px;color:#64748b;font-size:10px;font-weight:700;
                                     text-transform:uppercase;letter-spacing:1.5px;">Application ID</p>
                          <p style="margin:0;color:#0f4c81;font-size:15px;font-weight:900;
                                     font-family:'Courier New',monospace;letter-spacing:1px;">
                            ${applicationId}
                          </p>
                        </td>
                        ${department ? `
                        <td style="text-align:right;">
                          <p style="margin:0 0 3px;color:#64748b;font-size:10px;font-weight:700;
                                     text-transform:uppercase;letter-spacing:1.5px;">Department</p>
                          <p style="margin:0;color:#1a1a2e;font-size:13px;font-weight:600;">
                            ${department}
                          </p>
                        </td>` : ''}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Status badge -->
              <div style="text-align:center;margin-top:16px;">
                <span style="background:${cfg.badgeBg};color:${cfg.badgeColor};
                             font-size:12px;font-weight:800;letter-spacing:2px;
                             padding:6px 18px;border-radius:20px;text-transform:uppercase;">
                  ${cfg.badgeText}
                </span>
              </div>

              ${paymentRows}
              ${messageBox}

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-top:28px;">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
                      href="${actionUrl}" style="height:48px;v-text-anchor:middle;width:240px;"
                      arcsize="17%" fillcolor="#0f4c81" stroke="f">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-size:15px;font-weight:700;">
                        ${ctaLabel} →
                      </center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${actionUrl}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-block;background:linear-gradient(135deg,#0f4c81,#1565a8);
                              color:#ffffff;text-decoration:none;padding:14px 44px;
                              border-radius:8px;font-size:15px;font-weight:700;
                              letter-spacing:0.3px;mso-hide:all;">
                      ${ctaLabel} &rarr;
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Contact notice -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:#f0f7ff;border:1px solid #b8d0f0;border-radius:8px;
                              padding:14px 18px;">
                    <p style="margin:0;color:#1e40af;font-size:12px;line-height:1.7;">
                      <strong>Questions?</strong> Contact the PhD Admissions Office at
                      <a href="mailto:support@periyaruniversity.ac.in"
                         style="color:#1e40af;">support@periyaruniversity.ac.in</a>
                      and quote your Application ID <strong>${applicationId}</strong>.
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
