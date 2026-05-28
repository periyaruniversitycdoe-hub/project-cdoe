'use strict';

/**
 * Generates a password changed confirmation email template
 * @param {object} p
 * @param {string} p.email             - Recipient email address
 * @param {string} p.portalName        - 'Student' | 'Admin' | 'Supervisor' | 'Research Centre'
 */
module.exports = function passwordChangedTemplate({
  email,
  portalName
}) {
  const year = new Date().getFullYear();
  
  // Format portal display name
  const displayPortal = portalName === 'center' ? 'Research Centre' : portalName.charAt(0).toUpperCase() + portalName.slice(1);
  
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Password Changed Successfully — Periyar University</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f7fa; font-family:'Segoe UI', Tahoma, Arial, sans-serif; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">

  <!-- Preheader -->
  <span style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
    Your Periyar University PhD Portal password was successfully updated.
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
              <div style="text-align:center; margin-bottom:28px;">
                <div style="display:inline-block; background:#ecfdf5; border-radius:50%; width:64px; height:64px; line-height:64px; text-align:center; margin-bottom:16px;">
                  <span style="color:#10b981; font-size:32px; font-weight:bold; vertical-align:middle;">✓</span>
                </div>
                <h2 style="margin:0; color:#0f4c81; font-size:22px; font-weight:700; letter-spacing:-0.5px;">
                  Password Changed Successfully
                </h2>
              </div>
              
              <p style="margin:0 0 20px; color:#4b5563; font-size:15px; line-height:1.6;">
                Hello,
              </p>
              
              <p style="margin:0 0 24px; color:#4b5563; font-size:15px; line-height:1.6;">
                This email confirms that the password for your account associated with the 
                <strong>Periyar University PhD ${displayPortal} Portal</strong> (${email}) has been successfully updated.
              </p>
              
              <p style="margin:0 0 28px; color:#4b5563; font-size:15px; line-height:1.6; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px;">
                🔑 You can now login to your portal using your new password.
              </p>

              <!-- Safety disclaimer -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid #f3f4f6; padding-top:24px; margin-top:32px;">
                <tr>
                  <td style="background:#fff1f2; border:1px solid #fecdd3; border-radius:8px; padding:16px 20px;">
                    <p style="margin:0; color:#9f1239; font-size:13px; line-height:1.6;">
                      <strong>⚠️ Important Security Notice:</strong><br/>
                      If you did not request this password change or believe someone has accessed your account without authorization, please contact the Periyar University IT Support team immediately at <a href="mailto:support@periyaruniversity.ac.in" style="color:#9f1239; font-weight:bold; text-decoration:underline;">support@periyaruniversity.ac.in</a> to lock your account and protect your data.
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
