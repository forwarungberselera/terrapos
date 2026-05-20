// Developer emails yang punya akses ke dev-panel
export const DEVELOPER_EMAILS = ["lovinbeneran@gmail.com"];

export function isDeveloperEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return DEVELOPER_EMAILS.includes(email.toLowerCase());
}
