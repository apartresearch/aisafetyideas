import { generateText, generateObject } from 'ai';
import type { ZodSchema } from 'zod';
import { env } from '$env/dynamic/private';

const MODEL = 'anthropic/claude-sonnet-4-6'; // resolved by the Vercel AI Gateway

function assertConfigured() {
  if (!env.AI_GATEWAY_API_KEY) throw new Error('AI is not configured (missing AI_GATEWAY_API_KEY)');
}

export async function generate(prompt: string): Promise<string> {
  assertConfigured();
  const { text } = await generateText({ model: MODEL as any, prompt });
  return text;
}

export async function generateStructured<T>(prompt: string, schema: ZodSchema<T>): Promise<T> {
  assertConfigured();
  const { object } = await generateObject({ model: MODEL as any, prompt, schema });
  return object as T;
}
