import Anthropic from "@anthropic-ai/sdk";

const replitBaseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
const replitApiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
const directApiKey = process.env.ANTHROPIC_API_KEY;

export const isAvailable =
  !!(replitBaseURL && replitApiKey) || !!directApiKey;

export const anthropic: Anthropic | null = isAvailable
  ? new Anthropic({
      apiKey: (replitApiKey || directApiKey)!,
      ...(replitBaseURL ? { baseURL: replitBaseURL } : {}),
    })
  : null;
