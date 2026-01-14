import { AzureOpenAI } from 'openai';
import { config } from '../config.js';

export function createOpenAIClient(): AzureOpenAI | null {
  const { endpoint, apiKey, deployment, apiVersion } = config.azure;
  if (!endpoint || !apiKey || !deployment) return null;

  // Configure OpenAI SDK for Azure OpenAI
  const client = new AzureOpenAI({
    endpoint,
    apiKey,
    deployment,
    apiVersion: apiVersion || '2024-10-01-preview',
  });
  return client;
}
