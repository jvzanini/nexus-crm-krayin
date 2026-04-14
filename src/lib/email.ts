import { Resend } from "resend";
import { APP_CONFIG } from "@/lib/app.config";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY ?? "re_missing_key");
  }
  return _resend;
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  await getResend().emails.send({
    from: APP_CONFIG.emailFrom,
    to,
    subject: `Redefinição de senha — ${APP_CONFIG.name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h1 style="color: #7c3aed; margin-bottom: 16px;">Redefinição de Senha</h1>
        <p>Você solicitou a redefinição de senha para a sua conta no ${APP_CONFIG.name}.</p>
        <p>Clique no link abaixo para redefinir sua senha. O link expira em 1 hora.</p>
        <a
          href="${resetUrl}"
          style="display: inline-block; margin: 24px 0; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;"
        >
          Redefinir Senha
        </a>
        <p style="color: #71717a; font-size: 14px;">
          Se você não solicitou isso, ignore este e-mail. Sua senha permanecerá a mesma.
        </p>
        <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
        <p style="color: #a1a1aa; font-size: 12px;">${APP_CONFIG.name} &copy; ${new Date().getFullYear()}</p>
      </div>
    `,
  });
}

export async function sendEmailVerificationEmail(
  to: string,
  verifyUrl: string
): Promise<void> {
  await getResend().emails.send({
    from: APP_CONFIG.emailFrom,
    to,
    subject: `Confirmação de e-mail — ${APP_CONFIG.name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h1 style="color: #7c3aed; margin-bottom: 16px;">Confirme seu novo e-mail</h1>
        <p>Você solicitou a alteração do seu e-mail no ${APP_CONFIG.name}.</p>
        <p>Clique no link abaixo para confirmar o novo endereço. O link expira em 1 hora.</p>
        <a
          href="${verifyUrl}"
          style="display: inline-block; margin: 24px 0; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;"
        >
          Confirmar E-mail
        </a>
        <p style="color: #71717a; font-size: 14px;">
          Se você não solicitou isso, ignore este e-mail.
        </p>
        <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
        <p style="color: #a1a1aa; font-size: 12px;">${APP_CONFIG.name} &copy; ${new Date().getFullYear()}</p>
      </div>
    `,
  });
}
