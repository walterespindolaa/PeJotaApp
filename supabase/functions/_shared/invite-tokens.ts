import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_URL = "https://app.useatlasapp.com";
const TOKEN_TTL_HOURS = 72;

export type InviteSource = "household" | "admin" | "business";

export interface CreateInviteTokenInput {
  userId: string;
  email: string;
  source: InviteSource;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Creates an invite token row. Returns the token UUID and the full accept-invite URL.
 * Caller is responsible for using SERVICE_ROLE supabase client.
 */
export async function createInviteToken(
  supabase: SupabaseClient,
  input: CreateInviteTokenInput,
): Promise<{ token: string; url: string; expiresAt: string }> {
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const token = crypto.randomUUID();

  const { error } = await supabase.from("account_invite_tokens").insert({
    token,
    user_id: input.userId,
    email: input.email.toLowerCase(),
    source: input.source,
    created_by: input.createdBy ?? null,
    expires_at: expiresAt,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw new Error(`Failed to create invite token: ${error.message}`);
  }

  return {
    token,
    url: `${APP_URL}/auth/accept-invite?token=${token}`,
    expiresAt,
  };
}

/**
 * Generates a cryptographically random password meeting Supabase Auth requirements.
 * NOT exposed to user — used server-side as throwaway credential, then user changes it.
 */
export function generateThrowawayPassword(): string {
  // 32 chars, mix of all classes, plenty of entropy
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;

  // Guarantee at least one of each class
  const guaranteed = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];

  const remaining = new Uint8Array(28);
  crypto.getRandomValues(remaining);
  const rest = Array.from(remaining, (b) => all[b % all.length]);

  // Shuffle
  const combined = [...guaranteed, ...rest];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return combined.join("");
}

/**
 * Builds the standard Atlas-branded onboarding email HTML.
 * Includes anti-spam improvements: personal greeting, human signature, plain-text fallback safe.
 */
export function buildInviteEmailHtml(params: {
  acceptUrl: string;
  recipientName: string;
  source: InviteSource;
  customSubjectIntro?: string;
}): string {
  const { acceptUrl, recipientName, source, customSubjectIntro } = params;

  const intro =
    customSubjectIntro ??
    (source === "household"
      ? "Estou te enviando um convite para acessar o Atlas em conjunto com sua família. O link abaixo te leva direto para criar sua senha e começar."
      : "Sua conta no Atlas já está pronta. O link abaixo te leva para a página onde você cria sua senha e finaliza o acesso.");

  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #2B3340;">
      <div style="background-color: #2B4A5C; padding: 28px 40px; text-align: center; border-radius: 14px 14px 0 0;">
        <h2 style="color: #ffffff; margin: 0;">Atlas</h2>
      </div>
      <div style="padding: 28px 40px;">
        <p style="font-size: 16px; color: #2B3340; margin: 0 0 12px 0;">Olá, ${recipientName}.</p>
        <p style="color: #4A5568; line-height: 1.7; font-size: 14px; margin: 0 0 20px 0;">${intro}</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${acceptUrl}" style="background-color: #2B4A5C; color: #ffffff; font-size: 15px; font-weight: 600; border-radius: 10px; padding: 14px 32px; text-decoration: none; display: inline-block;">
            Criar minha senha
          </a>
        </div>
        <p style="color: #6B7280; font-size: 13px; line-height: 1.6; margin: 20px 0 0 0;">
          Se o botão não funcionar, copie este endereço no seu navegador:<br />
          <span style="color: #4A5568; font-size: 12px; word-break: break-all;">${acceptUrl}</span>
        </p>
        <p style="color: #6B7280; font-size: 13px; margin-top: 20px;">
          O link é válido por 72 horas e funciona apenas uma vez. Se expirar, é só me avisar que envio outro.
        </p>
        <div style="border-top: 1px solid #EDE8DF; margin-top: 28px; padding-top: 20px;">
          <p style="color: #4A5568; font-size: 14px; margin: 0 0 4px 0;">Abraço,</p>
          <p style="color: #2B3340; font-size: 14px; font-weight: 600; margin: 0;">Walter Espindola</p>
          <p style="color: #8B7D6B; font-size: 12px; margin: 2px 0 0 0;">Fundador da Zephyr & Atlas</p>
        </div>
      </div>
      <div style="padding: 14px 40px; border-top: 1px solid #EDE8DF; text-align: center;">
        <p style="font-size: 11px; color: #A09472; margin: 0 0 4px 0;">
          © ${new Date().getFullYear()} Atlas — Organização Financeira
        </p>
        <p style="font-size: 11px; color: #B0A89A; margin: 0;">
          Você recebeu este email porque foi convidado a usar o Atlas. Caso não tenha pedido este convite, ignore — não acontece nada.
        </p>
      </div>
    </div>
  `;
}
