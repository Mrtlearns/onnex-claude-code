import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_KEY as string;

export const genAI = new GoogleGenerativeAI(apiKey);

export const AI_MODELS = {
  primary: "models/gemini-3.1-flash-lite-preview",
  fallback: "models/gemini-flash-latest",
} as const;

export function getModel(modelId: string = AI_MODELS.primary, systemInstruction?: string) {
  return genAI.getGenerativeModel({
    model: modelId,
    ...(systemInstruction ? { systemInstruction } : {}),
  });
}

/** Run fn with primary model; on any error retry with fallback. */
export async function withFallback<T>(
  fn: (modelId: string) => Promise<T>
): Promise<T> {
  try {
    return await fn(AI_MODELS.primary);
  } catch {
    return await fn(AI_MODELS.fallback);
  }
}
