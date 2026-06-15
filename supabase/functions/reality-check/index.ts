import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Answers = {
  situation?: string;
  motivation?: string;
  timeframe?: string;
  tradeoff?: string;
};

type RoleCtx = {
  role_name: string;
  short_description?: string | null;
  reality_check?: string | null;
  uncomfortable_truth?: string | null;
  opportunity_cost?: string | null;
  who_not_for?: string | null;
  career_regret_risk?: string | null;
  competition_level?: string | null;
  demand?: string | null;
  ai_impact_level?: string | null;
  salary_entry?: number | null;
  salary_experienced?: number | null;
  salary_senior?: number | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { role, answers } = (await req.json()) as { role: RoleCtx; answers: Answers };
    if (!role?.role_name) {
      return new Response(JSON.stringify({ error: "role required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = `You are Clear Routes' reality-check coach. You speak plainly and honestly to UK adults considering a career move. No corporate fluff, no false reassurance, no toxic doom. 4-6 short sentences total. Address the reader as "you".

Structure your reply as STRICT JSON with these keys:
{
  "verdict": one of "Realistic", "Realistic but hard", "Long shot", "Probably not for you",
  "headline": one punchy sentence (max ~18 words) summarising the verdict for this person,
  "honest_take": 2-3 sentences citing the specific things they said and the role facts,
  "watch_outs": array of 2-3 short bullet strings,
  "if_you_go_for_it": one concrete next-step sentence
}
Return JSON only, no markdown.`;

    const roleFacts = [
      role.short_description && `Role: ${role.short_description}`,
      role.reality_check && `Reality: ${role.reality_check}`,
      role.uncomfortable_truth && `Uncomfortable truth: ${role.uncomfortable_truth}`,
      role.opportunity_cost && `Opportunity cost: ${role.opportunity_cost}`,
      role.who_not_for && `Not a good fit if: ${role.who_not_for}`,
      role.career_regret_risk && `Why people leave: ${role.career_regret_risk}`,
      role.competition_level && `Competition: ${role.competition_level}`,
      role.demand && `Demand: ${role.demand}`,
      role.ai_impact_level && `AI risk: ${role.ai_impact_level}`,
      (role.salary_entry || role.salary_experienced || role.salary_senior) &&
        `Salary £: entry ${role.salary_entry ?? "?"}, exp ${role.salary_experienced ?? "?"}, senior ${role.salary_senior ?? "?"}`,
    ]
      .filter(Boolean)
      .join("\n");

    const user = `Career being considered: ${role.role_name}

What we know about this role:
${roleFacts}

What the user told us about themselves:
- Current situation: ${answers.situation || "(not given)"}
- Why they want this: ${answers.motivation || "(not given)"}
- Timeframe / urgency: ${answers.timeframe || "(not given)"}
- What they're willing to trade off (time, money, stability): ${answers.tradeoff || "(not given)"}

Reality-check this person against this specific role. Be specific to what they said.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI gateway error", detail: text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const content: string = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { verdict: "Realistic but hard", headline: "Here's what to weigh.", honest_take: content, watch_outs: [], if_you_go_for_it: "" };
    }

    return new Response(JSON.stringify({ result: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
