import { google } from "@ai-sdk/google";

const MODEL_ID = "gemini-2.5-flash";

/** Pre-configured AI model instance. All AI calls should use this. */
export const aiModel = google(MODEL_ID);

/** Model identifier persisted alongside cached insights in the DB. */
export const AI_MODEL_ID = MODEL_ID;

/** Whether the AI provider API key is configured in the environment. */
export function isAiConfigured(): boolean {
  return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}
