import type { ChatRequest } from "@/types/chat";

export const maximumChatBodyBytes = 20_000;
export const maximumChatMessages = 12;

export function serializeChatRequest(locale: ChatRequest["locale"], messages: ChatRequest["messages"]): string {
  const recent = messages.slice(-maximumChatMessages).map(({ role, content }) => ({ role, content }));
  const encoder = new TextEncoder();
  let body = JSON.stringify({ locale, messages: recent });
  // History can reach the byte limit before the message-count limit, especially
  // in Russian. Drop the oldest context while preserving the latest user input.
  while (recent.length > 1 && encoder.encode(body).byteLength > maximumChatBodyBytes) {
    recent.shift();
    body = JSON.stringify({ locale, messages: recent });
  }
  return body;
}
