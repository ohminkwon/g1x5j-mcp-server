export type Config = {
  pat: string;
  baseUrl: string;
};

export function loadConfig(): Config {
  const pat = process.env.TDL_PAT;
  if (!pat) {
    console.error("TDL_PAT env var required");
    process.exit(1);
  }
  const baseUrl = (process.env.TDL_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
  return { pat, baseUrl };
}
