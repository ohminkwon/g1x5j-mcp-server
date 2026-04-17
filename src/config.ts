export type Config = {
  pat: string;
  baseUrl: string;
  timezone: string;
};

export function loadConfig(): Config {
  const pat = process.env.TDL_PAT;
  if (!pat) {
    console.error("TDL_PAT env var required");
    process.exit(1);
  }
  const baseUrl = (process.env.TDL_BASE_URL ?? "https://api.g1x5j.app").replace(/\/$/, "");
  const timezone =
    process.env.TDL_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone;
  return { pat, baseUrl, timezone };
}
