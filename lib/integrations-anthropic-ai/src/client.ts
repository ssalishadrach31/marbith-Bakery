import Anthropic from "@anthropic-ai/sdk";

const configuredBaseURL = process.env.ANTHROPIC_BASE_URL;
const directApiKey = process.env.ANTHROPIC_API_KEY;

export const isAvailable = !!directApiKey;

export const anthropic: Anthropic | null = isAvailable
  ? new Anthropic({
      apiKey: directApiKey,
      ...(configuredBaseURL ? { baseURL: configuredBaseURL } : {}),
    })
  : null;
