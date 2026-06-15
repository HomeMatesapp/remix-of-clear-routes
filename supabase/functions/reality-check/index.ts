import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// NOTE: type shapes are mirrored from src/lib/reality-check/types.ts. Edge
// functions can't import from src/, so keep these in sync if the schema moves.

type Answers = {
  startingPoint: string | null;
  incomeNeed: string | null;
  weeklyHours: string | null;
  budget: string | null;
  area: string;
  commuteFlex: string | null;
  notes: string;
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
  pathway_school_leaver?: string | null;
  pathway_graduate?: string | null;
  pathway_adjacent?: string | null;
  pathway_no_background?: string | null;
  typical_backgrounds?: string | null;
  key_employers?: string[] | null;
};

const startingToPathway: Record<string, string> = {
  school_leaver:  "school_leaver",
  graduate:       "graduate",
  career_changer: "adjacent",
  adjacent:       "adjacent",
  no_background:  "no_background",
};

const fallbackResult = {
  overallVerdict: "Realistic but hard",
  bestRoute: {
    title: "Couldn't generate a tailored route",
    summary: "The reality-check engine didn't return a clean result. Try again in a moment.",
    whyThisFits: [],
    estimatedTime: "—",
    likelyCost: "—",
    mainDifficulty: "—",
    confidence: "low",
  },
  backupRoute: { title: "—", summary: "—", tradeOff: "—" },
  routeToAvoid: { title: "—", whyRisky: "—", whenItMightWork: "—" },
  localRealism: { rating: "mixed", summary: "—", dependsOn: [] },
  firstMoves: [],
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

    // Pick the role's pathway text most relevant to this person's starting point.
    const pathwayKey = answers.startingPoint ? startingToPathway[answers.startingPoint] : null;
    const pathwayText =
      pathwayKey === "school_leaver" ? role.pathway_school_leaver :
      pathwayKey === "graduate"      ? role.pathway_graduate :
      pathwayKey === "adjacent"      ? role.pathway_adjacent :
      pathwayKey === "no_background" ? role.pathway_no_background :
      null;

    const system = `You are Clear Routes' route judgement engine. Clear Routes is brutally honest about UK careers — no corporate fluff, no false reassurance, no doom-mongering. You judge the most realistic route into a specific role for THIS specific person, using the constraints they gave you and the role facts provided.

CRITICAL DIFFERENTIATION: every response MUST include a real "routeToAvoid" — the route this person should NOT take, and why. This is the heart of Clear Routes. Never soften it, never hide it, never replace it with a "consider carefully" hedge. Name the bad route concretely (e.g. "Self-funded £9k bootcamp", "Three-year MSc", "Cold-applying with no portfolio") and explain the specific failure mode for THIS person.

Output STRICT JSON matching this exact shape — no markdown, no commentary:
{
  "overallVerdict": "Realistic" | "Realistic but hard" | "Long shot" | "Probably not for you",
  "bestRoute": {
    "title": string,                  // concrete route name, e.g. "Level 6 Digital Apprenticeship"
    "summary": string,                // 1-2 sentences, plain English
    "whyThisFits": string[],          // 2-4 short bullets tied to THEIR constraints
    "estimatedTime": string,          // e.g. "12-18 months"
    "likelyCost": string,             // e.g. "£0 (employer-funded)" or "~£1,200 self-funded"
    "mainDifficulty": string,         // the one thing that will be hard
    "confidence": "high" | "medium" | "low"
  },
  "backupRoute": {
    "title": string,
    "summary": string,                // 1-2 sentences
    "tradeOff": string                // what they give up vs the best route
  },
  "routeToAvoid": {
    "title": string,                  // the concrete bad route for them
    "whyRisky": string,               // specific failure mode for THIS person
    "whenItMightWork": string         // honest edge case where it could still make sense
  },
  "localRealism": {
    "rating": "strong" | "mixed" | "weak",
    "summary": string,                // 1-2 sentences about their area / commute setup
    "dependsOn": string[]             // 1-3 short factors (e.g. "willingness to commute to Manchester")
  },
  "firstMoves": string[]              // exactly 3 concrete next actions, imperative voice
}`;

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
      role.typical_backgrounds && `What successful people did: ${role.typical_backgrounds}`,
      role.key_employers?.length ? `Key employers: ${role.key_employers.join(", ")}` : null,
      pathwayText && `Most relevant pathway text for this person:\n${pathwayText}`,
    ]
      .filter(Boolean)
      .join("\n");

    const userMsg = `Career being considered: ${role.role_name}

What we know about this role:
${roleFacts}

What this person told us about themselves:
- Starting point: ${answers.startingPoint ?? "(not given)"}
- Need to earn while training: ${answers.incomeNeed ?? "(not given)"}
- Weekly time available: ${answers.weeklyHours ?? "(not given)"}
- Budget: ${answers.budget ?? "(not given)"}
- Area (UK): ${answers.area || "(not given)"}
- Commute / relocation: ${answers.commuteFlex ?? "(not given)"}
- Other notes: ${answers.notes || "(none)"}

Judge the most realistic route for THIS person. Be specific to their constraints. Remember: routeToAvoid is mandatory and must be concrete.`;

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
          { role: "user", content: userMsg },
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
      parsed = fallbackResult;
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
