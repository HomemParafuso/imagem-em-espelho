export async function askLocalAgent({ url, model, instructions, messages, marketContext, temperature }: { url: string; model: string; instructions: string; messages: {role: "user" | "assistant"; content: string}[]; marketContext?: string | undefined; temperature: number }): Promise<{ok: boolean; text: string}> {
  const endpoint = new URL(url);
  if (!["http:","https:"].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error("Use uma URL HTTP ou HTTPS sem credenciais.");
  const response = await fetch(`${endpoint.href.replace(/\/$/,"")}/api/chat`, {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({model,stream:false,messages:[{role:"system",content:[instructions,marketContext].filter(Boolean).join("\n\n")},...messages],options:{temperature}}),
  });
  if (!response.ok) return {ok:false,text:`O provedor local retornou erro ${response.status}.`};
  const data: unknown = await response.json();
  if (typeof data !== "object" || data === null || !("message" in data) || typeof data.message !== "object" || data.message === null || !("content" in data.message) || typeof data.message.content !== "string") return {ok:false,text:"Resposta incompatível com Ollama."};
  return {ok:true,text:data.message.content};
}