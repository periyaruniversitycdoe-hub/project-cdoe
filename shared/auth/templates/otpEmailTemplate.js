'use strict';

/**
 * Generates an OTP verification email template
 * @param {object} p
 * @param {string} p.email             - Recipient email address
 * @param {string} p.otp               - 4-digit or 6-digit OTP code
 * @param {string} p.portalName        - 'Student' | 'Admin' | 'Supervisor' | 'Research Centre'
 * @param {number} [p.expiresIn = 5]   - Expiration in minutes
 */
module.exports = function otpEmailTemplate({
  email,
  otp,
  portalName,
  expiresIn = 5
}) {
  const year = new Date().getFullYear();
  
  // Format portal display name
  const displayPortal = portalName === 'center' ? 'Research Centre' : portalName.charAt(0).toUpperCase() + portalName.slice(1);
  
  // Split OTP into digits for a premium UI
  const digits = String(otp).split('');
  const digitCells = digits.map(d => `
    <td style="width:48px; height:56px; text-align:center; vertical-align:middle; 
               background:#0f4c81; border-radius:8px; 
               font-size:28px; font-weight:800; color:#ffffff; 
               font-family:'Courier New', monospace; margin:0 4px;
               box-shadow: 0 4px 10px rgba(15,76,129,0.25);">
      ${d}
    </td>
    <td style="width:8px;"></td>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Password Reset OTP — Periyar University</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f7fa; font-family:'Segoe UI', Tahoma, Arial, sans-serif; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">

  <!-- Preheader -->
  <span style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
    Your password reset OTP is ${otp}. Valid for ${expiresIn} minutes.
  </span>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f7fa;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        
        <!-- Outer card -->
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" 
               style="max-width:600px; width:100%; background:#ffffff; border-radius:16px; 
                      overflow:hidden; box-shadow:0 10px 40px rgba(15,76,129,0.08); border: 1px solid #eef2f6;">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg, #0f4c81 0%, #1565a8 100%); padding:40px 40px 32px; text-align:center;">
              <div style="display:inline-block; background:rgba(255,255,255,0.18); border-radius:50%; 
                          width:76px; height:76px; line-height:76px; text-align:center; 
                          border:2px solid rgba(255,255,255,0.3); margin-bottom:16px;">
                <span style="color:#ffffff; font-size:28px; font-weight:800; vertical-align:middle; font-family:'Segoe UI', Arial, sans-serif;">PU</span>
              </div>
              <h1 style="margin:0 0 4px; color:#ffffff; font-size:22px; font-weight:800; letter-spacing:1px; text-transform:uppercase;">
                PERIYAR UNIVERSITY
              </h1>
              <p style="margin:0; color:rgba(255,255,255,0.75); font-size:12px; letter-spacing:0.5px;">
                Salem – 636 011, Tamil Nadu, India
              </p>
            </td>
          </tr>

          <!-- Red accent strip -->
          <tr><td style="background:linear-gradient(90deg, #901a1e, #c0392b); height:4px;"></td></tr>

          <!-- Body -->
          <tr>
            <td style="padding:44px 48px; background:#ffffff;">
              <h2 style="margin:0 0 16px; color:#0f4c81; font-size:22px; font-weight:700; letter-spacing:-0.5px;">
                Password Reset Verification
              </h2>
              
              <p style="margin:0 0 24px; color:#4b5563; font-size:15px; line-height:1.6;">
                Hello,
              </p>
              
              <p style="margin:0 0 28px; color:#4b5563; font-size:15px; line-height:1.6;">
                We received a request to reset the password for your account associated with the 
                <strong>${displayPortal} Portal</strong> (${email}). 
                Use the one-time password (OTP) code below to verify your request.
              </p>

              <!-- OTP display grid -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 32px;">
                <tr>
                  ${digitCells}
                </tr>
              </table>

              <!-- Expiry Alert -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:32px;">
                <tr>
                  <td style="background:#fffbeb; border:1px solid #fef3c7; border-radius:10px; padding:16px 20px; text-align:center;">
                    <p style="margin:0; color:#b45309; font-size:14px; font-weight:600;">
                      ⏰ This code will expire in ${expiresIn} minutes.
                    </p>
                    <p style="margin:4px 0 0; color:#78350f; font-size:12px;">
                      If it expires, you will need to request a new OTP.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Safety disclaimer -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid #f3f4f6; padding-top:24px;">
                <tr>
                  <td>
                    <p style="margin:0; color:#9ca3af; font-size:12px; line-height:1.6;">
                      <strong>Security Note:</strong> Never share this OTP code with anyone. Periyar University administrators or support staff will never ask for your password or OTP. If you did not make this request, you can safely ignore this email — your account remains secure.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb; border-top:1px solid #f0f2f5; padding:32px 48px; text-align:center;">
              <p style="margin:0 0 6px; color:#901a1e; font-size:12px; font-weight:700; letter-spacing:1px; text-transform:uppercase;">
                Periyar University — PhD Admission System
              </p>
              <p style="margin:0; color:#9ca3af; font-size:11px; line-height:1.7;">
                Periyar Palkalai Nagar, Salem – 636 011, Tamil Nadu, India<br />
                &copy; ${year} Periyar University. All rights reserved.<br />
                This is an automated system notification. Please do not reply to this email.
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
