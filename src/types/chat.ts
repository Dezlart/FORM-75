import type { Locale } from "./product";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  locale: Locale;
  messages: Array<Pick<ChatMessage, "role" | "content">>;
}

export interface ChatResponse {
  message?: string;
  error?: "invalid_request" | "rate_limited" | "unavailable" | "timeout" | "server_error";
}
