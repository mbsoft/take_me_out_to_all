import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function sendVerificationEmail(email: string, token: string) {
  const fromEmail = process.env.EMAIL_FROM || "noreply@takemeouttotheballparks.com";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const verifyUrl = `${appUrl}/api/auth/verify-email?token=${token}`;

  console.log(`Sending verification email to ${email} from ${fromEmail}`);
  const { data, error } = await getResend().emails.send({
    from: fromEmail,
    to: email,
    subject: "Verify your email - Take Me Out to the Ballparks",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #1a1a1a; font-size: 24px; margin: 0;">
            Take Me Out to the Ballparks
          </h1>
        </div>
        <p style="color: #333; font-size: 16px; line-height: 1.5;">
          Welcome! Please verify your email address to get started planning your
          ballpark road trip.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verifyUrl}"
             style="background-color: #2563eb; color: white; padding: 12px 32px;
                    border-radius: 6px; text-decoration: none; font-weight: 600;
                    display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #666; font-size: 14px; line-height: 1.5;">
          This link expires in 24 hours. If you didn't create an account, you can
          safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">
          If the button doesn't work, copy and paste this URL into your browser:<br/>
          <a href="${verifyUrl}" style="color: #2563eb;">${verifyUrl}</a>
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Resend API error:", error);
    throw new Error(`Resend API error: ${error.message}`);
  }

  console.log("Verification email sent successfully:", data?.id);
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const fromEmail = process.env.EMAIL_FROM || "noreply@takemeouttotheballparks.com";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  console.log(`Sending password reset email to ${email} from ${fromEmail}`);
  const { data, error } = await getResend().emails.send({
    from: fromEmail,
    to: email,
    subject: "Reset your password - Take Me Out to the Ballparks",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #1a1a1a; font-size: 24px; margin: 0;">
            Take Me Out to the Ballparks
          </h1>
        </div>
        <p style="color: #333; font-size: 16px; line-height: 1.5;">
          We received a request to reset your password. Click the button below
          to choose a new password.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}"
             style="background-color: #2563eb; color: white; padding: 12px 32px;
                    border-radius: 6px; text-decoration: none; font-weight: 600;
                    display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #666; font-size: 14px; line-height: 1.5;">
          This link expires in 1 hour. If you didn&rsquo;t request a password reset,
          you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">
          If the button doesn&rsquo;t work, copy and paste this URL into your browser:<br/>
          <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Resend API error:", error);
    throw new Error(`Resend API error: ${error.message}`);
  }

  console.log("Password reset email sent successfully:", data?.id);
}
