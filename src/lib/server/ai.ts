import { generateText, generateObject, gateway } from 'ai';
import type { ZodSchema } from 'zod';
import { env } from '$env/dynamic/private';

function assertConfigured() {
  if (!env.AI_GATEWAY_API_KEY) throw new Error('AI is not configured (missing AI_GATEWAY_API_KEY)');
}

function model() {
  return gateway('anthropic/claude-sonnet-4-6');
}

export async function generate(prompt: string): Promise<string> {
  assertConfigured();
  const { text } = await generateText({ model: model(), prompt });
  return text;
}

export async function generateStructured<T>(prompt: string, schema: ZodSchema<T>): Promise<T> {
  assertConfigured();
  const { object } = await generateObject({ model: model(), prompt, schema });
  return object as T;
}
