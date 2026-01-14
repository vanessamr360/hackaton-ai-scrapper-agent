import dotenv from "dotenv";
// Ensure .env values override any stale shell env vars from prior tests
dotenv.config({ override: true });

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  headless: (process.env.HEADLESS || "true").toLowerCase() === "true",
  websiteUrl: process.env.WEBSITE_URL || "https://diariodarepublica.pt/dr/home",
  websiteName: process.env.WEBSITE_NAME || "diariodarepublica.pt",
  preferNativeExport: (process.env.PREFER_NATIVE_EXPORT || "true").toLowerCase() === "true",
  logLevel: (process.env.LOG_LEVEL || "info").toLowerCase(),
  logJson: (process.env.LOG_JSON || "true").toLowerCase() === "true",
  azure: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || "",
    apiKey: process.env.AZURE_OPENAI_API_KEY || "",
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "",
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-10-01-preview",
  },
};


