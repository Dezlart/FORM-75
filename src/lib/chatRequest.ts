import { z } from "zod";
import type { ChatRequest } from "@/types/chat";
import { maximumChatBodyBytes, maximumChatMessages } from "@/lib/chatHistory";

const messageSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("user"), content: z.string().trim().min(1).max(800) }).strict(),
  // Generated answers may be longer than the user's input field. They must
  // remain valid when the client includes them in the following request.
  z.object({ role: z.literal("assistant"), content: z.string().trim().min(1).max(4_000) }).strict(),
]);
const requestSchema = z.object({ locale: z.enum(["ru", "en"]), messages: z.array(messageSchema).min(1).max(maximumChatMessages) }).strict();

export async function readChatRequest(request: Request): Promise<ChatRequest | null> {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  const declaredBytes = Number(request.headers.get("content-length") ?? "0");
  if (contentType !== "application/json" || !Number.isSafeInteger(declaredBytes) || declaredBytes < 0 || declaredBytes > maximumChatBodyBytes) {
    void request.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!request.body) return null;

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytesRead = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > maximumChatBodyBytes) {
        // Do not buffer the rest of a chunked body or depend on Content-Length.
        void reader.cancel().catch(() => undefined);
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const parsed = requestSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    void reader.cancel().catch(() => undefined);
    return null;
  } finally {
    reader.releaseLock();
  }
}
