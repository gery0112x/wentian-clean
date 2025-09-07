import { NextResponse } from "next/server";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try{
    const { messages = [{role:"user", content:"ping"}], model = "gpt-4o-mini-2024-07-18", max_tokens = 64 } = await req.json().catch(()=> ({}));
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method:"POST",
      headers:{
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,   // OpenAI 金鑰
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ model, messages, max_tokens })
    });
    const j = await r.json();
    return NextResponse.json({
      provider:"openai",
      model,
      status:r.status,
      reply: j?.choices?.[0]?.message?.content ?? null,
      usage: j?.usage ?? null,
      raw: j
    }, { status: 200 });
  }catch(e:any){
    return NextResponse.json({ provider:"openai", error:String(e?.message||e) }, { status: 500 });
  }
}
