export type OAuthEnvironment = "local" | "preview" | "production";

const environmentAliases: Record<string, OAuthEnvironment> = {
  development: "local",
  local: "local",
  preview: "preview",
  production: "production",
};

function configuredEnvironment(): OAuthEnvironment {
  const configured = (process.env.OAUTH_ENVIRONMENT ?? process.env.VERCEL_ENV ?? "local").toLowerCase();
  const environment = environmentAliases[configured];
  if (!environment) throw new Error("OAUTH_ENVIRONMENT must be local, preview, or production.");
  return environment;
}

// OAuth clients issue refresh tokens that are only valid for that client.
// Keep each deployment environment's tokens in a separate account record.
export const oauthEnvironment = configuredEnvironment();
