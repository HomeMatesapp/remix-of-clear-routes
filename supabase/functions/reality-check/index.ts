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

    const system = `You are Clear Routes' route judgement engine. Clear Routes is brutally honest about UK careers — no corporate fluff, no false reassurance, no doom-mongering, no motivational filler. You judge the most realistic route into a specific role for THIS specific person, using ONLY the constraints they gave you and the role facts provided.

CRITICAL DIFFERENTIATION: every response MUST include a real "routeToAvoid" — a route this person could plausibly be tempted by, and why it is the wrong one for them. This is the heart of Clear Routes. Never soften it, never hide it, never replace it with a "consider carefully" hedge. Never use an obviously implausible strawman (e.g. a "bootcamp" for a regulated clinical profession). It must be a route a reasonable person in their situation might actually consider.

THE RECOMMENDATION MUST CHANGE WHEN CONSTRAINTS CHANGE. Need-to-earn, budget, and weekly hours should heavily influence the route. A career changer who needs income with £0 budget MUST get a different bestRoute than a full-time-study graduate with £2,000+ budget.

GROUNDING RULES — non-negotiable:
1. Do not name a specific provider, university, employer, course, trust, college, agency, or scheme unless its exact name appears in the supplied role data. Prefer generic descriptions ("an NHS trust in your area", "a local FE college's Access to HE", "an apprenticeship provider listed on the government's Find an Apprenticeship service").
2. Do not invent salaries, fees, timelines, or eligibility rules not present in the role data or widely-known UK fact (e.g. UK tuition fee cap). If a number isn't supported, use a qualitative phrase ("low cost", "salaried throughout") instead of a fabricated figure.
3. Do not claim live local availability ("there are 12 trusts in Manchester", "London has plenty of intakes"). You do not have live local data. Local realism is approximate.
4. Prefer the supplied role pathway fields over inventing new pathways. Use the pathway text labelled "Most relevant pathway text for this person" as your primary source for bestRoute.
5. If a piece of role data is missing, say so or stay generic. Never fill gaps with plausible-sounding inventions.

LOCAL REALISM RULES:
- rating is approximate, based on whether the role typically has nationwide employer presence (e.g. NHS trusts, schools, councils → "strong" most places) vs concentrated (e.g. ML engineering → "mixed/weak" outside major hubs).
- The summary must explicitly acknowledge uncertainty: "approximate, based on national pattern" or similar. Do NOT pretend to know live vacancy counts or specific local employers unless they're in role data.
- If the user gave no area, rating = "mixed" and summary says area not given.

FIRST MOVES RULES — exactly 3, each must start with a concrete verb:
search / apply / check / compare / contact / book / sign up / build / shadow / open
Each must be something the person could do this week. No "research the role", no "think about whether", no "explore your options". Reference UK-known services generically where helpful (UCAS, NHS Jobs, Find an Apprenticeship, gov.uk, Indeed) — not specific employer names absent from role data.

NO FLUFF: no "embarking on a journey", no "exciting career", no "passion", no "you've got this". Plain English only.

Output STRICT JSON matching this exact shape — no markdown, no commentary:
{
  "overallVerdict": "Realistic" | "Realistic but hard" | "Long shot" | "Probably not for you",
  "bestRoute": {
    "title": string,                  // concrete route name from the role's pathway data
    "summary": string,                // 1-2 sentences, plain English
    "whyThisFits": string[],          // 2-4 short bullets tied to THEIR specific constraints
    "estimatedTime": string,          // e.g. "12-18 months"
    "likelyCost": string,             // e.g. "£0 (employer-funded)" or "low" — qualitative if no figure available
    "mainDifficulty": string,         // the one thing that will be hard for THEM
    "confidence": "high" | "medium" | "low"
  },
  "backupRoute": {
    "title": string,
    "summary": string,                // 1-2 sentences
    "tradeOff": string                // what they give up vs the best route
  },
  "routeToAvoid": {
    "title": string,                  // a plausible-but-wrong route for them
    "whyRisky": string,               // specific failure mode for THIS person, tied to their constraints
    "whenItMightWork": string         // honest edge case where it could still make sense
  },
  "localRealism": {
    "rating": "strong" | "mixed" | "weak",
    "summary": string,                // 1-2 sentences, must acknowledge it's approximate
    "dependsOn": string[]             // 1-3 short factors
  },
  "firstMoves": string[]              // exactly 3 concrete actions starting with a verb
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
