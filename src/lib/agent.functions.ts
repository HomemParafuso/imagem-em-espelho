import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const AGENT_MODELS = ["openai/gpt-6-astra", "openai/gpt-6.1-terra", "openai/gpt-5.5", "openai/gpt-5.4-mini"] as const;

const Input = z.object({
  model: z.enum(AGENT_MODELS),
  instructions: z.string().max(8000),
  temperature: z.number().min(0).max(2),
  marketContext: z.string().max(4000).optional(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20000) })).min(1).max(200),
});

export const askAgent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
    const instructions = [data.instructions, data.marketContext ? `Dados atuais do gráfico:\n${data.marketContext}` : ""].filter(Boolean).join("\n\n");
    try {
      const res = await generateResponse({
        model: data.model,
        instructions,
        ...(data.model === "openai/gpt-5.4-mini" ? { temperature: data.temperature } : {}),
        input: data.messages.map((m) => ({ role: m.role, content: m.content })),
      } as Parameters<typeof generateResponse>[0]);
      const out = (res as { output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> }).output ?? [];
      const text = out.flatMap((o) => (o.type === "message" ? (o.content ?? []) : []))
        .filter((c) => c.type === "output_text").map((c) => c.text ?? "").join("");
      return { ok: true as const, text: text || "(sem resposta)" };
    } catch (e) {
      if (e instanceof GatewayError) {
        const msg = e.httpStatus === 402 ? "Créditos de IA esgotados." : e.httpStatus === 429 ? "Muitas requisições, tente em instantes." : e.message;
        return { ok: false as const, text: msg };
      }
      throw e;
    }
  });
