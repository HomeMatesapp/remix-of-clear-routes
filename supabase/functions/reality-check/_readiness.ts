// Mirror of src/lib/reality-check/readiness.ts for the Deno edge function.
// Keep in sync — the engine is identical; only the import style differs.
//
// Why a mirror instead of an import: Supabase edge functions can't reach into
// the Vite app's src tree, and we want this engine vitest-runnable in the UI
// repo. Both files are intentionally tiny and pure.

// Local copies of the types we need. (We can't import from src/.)
type Answers = {
  startingPoint: string | null;
  relevantBackground?: string;
  englishMaths?: string | null;
  scienceSubjects?: string | null;
  qualificationLevel?: string | null;
  englishComfort?: string | null;
  incomeNeed: string | null;
  weeklyHours: string | null;
  budget: string | null;
  region?: string | null;
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

const has = (s: string | null | undefined): boolean =>
  typeof s === "string" && s.trim().length >= 3;

const lower = (role: RoleCtx): string => (role.role_name || "").toLowerCase();
const isClinical = (r: RoleCtx) =>
  /(nurse|midwif|paramedic|therapist|radiograph|pharmacist|dentist|doctor|physician|social worker)/.test(lower(r));
const isScience = (r: RoleCtx) =>
  isClinical(r) ||
  /(engineer|scientist|laboratory|biomed|chemist|physicist|veterinar|biolog|data analyst)/.test(lower(r));
const isTrade = (r: RoleCtx) =>
  /(electrician|plumber|carpenter|joiner|bricklayer|mechanic|welder|roofer|plasterer|gas engineer|hgv driver|technician|builder|tiler|painter and decorator|dental nurse|pharmacy technician)/.test(lower(r));
const isTeaching = (r: RoleCtx) =>
  /(teacher|teaching|lecturer)/.test(lower(r));
const isTech = (r: RoleCtx) =>
  /(software|developer|engineer|programmer|data|cyber|devops|machine learning|ml|analyst|architect|designer)/.test(lower(r));

type Rule = { id: string; message: string };
type Readiness = "ready_now" | "nearly_ready" | "needs_bridging" | "high_risk_now";

export function classify(a: Answers, role: RoleCtx): { readiness: Readiness; rules: Rule[] } {
  const blockers: Rule[] = [];
  const concerns: Rule[] = [];
  const clinical = isClinical(role);
  const science = isScience(role);
  const trade = isTrade(role);
  const teaching = isTeaching(role);
  const ql = a.qualificationLevel;
  const em = a.englishMaths;
  const sci = a.scienceSubjects;
  const bg = a.relevantBackground;
  const income = a.incomeNeed;
  const budget = a.budget;
  const hours = a.weeklyHours;
  const english = a.englishComfort;

  if (clinical && (em === "no" || ql === "none")) {
    blockers.push({ id: "blocker_no_gcse_clinical", message: "Most regulated healthcare routes require GCSE English and maths (or accepted equivalents) before training begins." });
  }
  if (teaching && (em === "no" || ql === "none")) {
    blockers.push({ id: "blocker_no_gcse_teaching", message: "Teacher training requires GCSE English, maths (and science for primary) at grade 4/C or above." });
  }
  if (science && !clinical && sci === "no" && ql !== "undergrad" && ql !== "postgrad") {
    blockers.push({ id: "blocker_no_science_stem", message: "This route typically expects some science or quantitative subjects at Level 3 or above." });
  }
  if (ql === "none" && !has(bg) && !trade) {
    blockers.push({ id: "blocker_no_quals_no_background", message: "Most entry routes need at least Level 2 qualifications or a clear track record of relevant work or study." });
  }
  if ((budget === "zero" || budget === "under_500") && hours === "0_5" && income === "need_income") {
    blockers.push({ id: "blocker_money_time_income", message: "With limited budget, very few weekly hours, and a need to earn, only paid (e.g. apprenticeship or assistant) routes are realistic right now." });
  }

  if (clinical && em === "not_sure") {
    concerns.push({ id: "bridge_unsure_gcse", message: "Confirm whether your English and maths qualifications meet the route's entry requirements before applying." });
  }
  if (ql === "level_2" && (clinical || teaching || science)) {
    concerns.push({ id: "bridge_level_2_only", message: "An Access to HE course or Level 3 qualification is usually the next step before degree-level training." });
  }
  if (a.startingPoint === "graduate" && !has(bg) && (clinical || teaching)) {
    concerns.push({ id: "bridge_unrelated_graduate", message: "A relevant top-up or pre-entry experience role (e.g. healthcare assistant, teaching assistant) is usually expected before training." });
  }
  if (english === "may_need_support") {
    concerns.push({ id: "bridge_english_support", message: "Planning for ESOL/IELTS or in-course language support is sensible before committing to a study-heavy route." });
  }
  if (em === "english_only" || em === "maths_only") {
    concerns.push({ id: "bridge_partial_gcse", message: "Functional Skills can fill the missing English/maths quickly and is accepted by many routes." });
  }
  if ((budget === "zero" || budget === "under_500") && !trade && income !== "need_income") {
    concerns.push({ id: "soft_budget_tight", message: "A tight training budget points you toward employer-funded, apprenticeship, or low-cost routes." });
  }
  if (hours === "0_5" && income !== "need_income") {
    concerns.push({ id: "soft_time_thin", message: "Very limited weekly hours will slow part-time study and may rule out full-time intensive routes." });
  }

  let readiness: Readiness;
  if (blockers.length >= 2) readiness = "high_risk_now";
  else if (blockers.length === 1) readiness = "needs_bridging";
  else if (concerns.length >= 1) readiness = "nearly_ready";
  else readiness = "ready_now";

  return { readiness, rules: [...blockers, ...concerns] };
}

const SP_PATHWAY: Record<string, string> = {
  school_leaver: "school_leaver", graduate: "graduate",
  career_changer: "adjacent", adjacent: "adjacent", no_background: "no_background",
};

export function buildResult(a: Answers, role: RoleCtx) {
  const j = classify(a, role);
  const clinical = isClinical(role);
  const trade = isTrade(role);
  const teaching = isTeaching(role);
  const tech = isTech(role);

  // Best route title
  let bestTitle = "Standard entry route";
  if (a.incomeNeed === "need_income") {
    bestTitle = clinical ? "Healthcare assistant → apprenticeship or degree apprenticeship route"
              : trade ? "Apprenticeship route"
              : teaching ? "Teaching assistant → salaried teacher training"
              : "Apprenticeship or paid trainee route";
  } else if (j.readiness === "needs_bridging" || j.readiness === "high_risk_now") {
    bestTitle = (clinical || teaching) ? "Bridging step first, then approved training route" : "Bridging step first, then the main entry route";
  } else {
    const key = a.startingPoint ? SP_PATHWAY[a.startingPoint] : null;
    if (key === "graduate") bestTitle = "Graduate entry route";
    else if (key === "school_leaver") bestTitle = "School leaver / Level 3 entry route";
    else if (key === "adjacent") bestTitle = "Adjacent-experience route";
  }

  const why: string[] = [];
  if (a.incomeNeed === "need_income") why.push("You need to earn while training, so paid/salaried routes are prioritised.");
  if (a.budget === "zero" || a.budget === "under_500") why.push("Your stated budget points to employer-funded or no-cost training.");
  if (a.weeklyHours === "20_plus" || a.weeklyHours === "10_20") why.push("You have enough weekly time to make steady progress on this route.");
  if (j.rules.length === 0 && a.qualificationLevel) why.push("Your current qualifications align with typical entry expectations.");

  const time = (j.readiness === "needs_bridging" || j.readiness === "high_risk_now")
    ? "Add 6–18 months for a bridging step before the main route"
    : clinical ? "Typically 3 years (degree) or 4 years (degree apprenticeship)"
    : teaching ? "Typically 1 year (PGCE) or 2 years (salaried route)"
    : trade ? "Typically 2–4 years (apprenticeship)"
    : "Depends on the route — confirm before applying";

  const cost = a.incomeNeed === "need_income" ? "Low — paid/salaried routes prioritised"
    : (a.budget === "zero" || a.budget === "under_500") ? "Low — employer-funded or no-cost routes prioritised"
    : "Depends on the route — confirm fees and funding before applying";

  const hard = j.rules[0]?.message
    || (clinical ? "Clinical placements and shift patterns during training"
       : teaching ? "Placements and workload during the training year"
       : trade ? "Securing an apprenticeship place — they're competitive"
       : "Sustained effort across the training period");

  const conf = j.readiness === "ready_now" ? "high" : j.readiness === "nearly_ready" ? "medium" : "low";
  const summary = j.readiness === "high_risk_now"
    ? "Build the basics first. The main route only makes sense once the blockers below are addressed."
    : j.readiness === "needs_bridging"
    ? "Take a bridging step first, then move on to the main entry route."
    : "This is the route with the best odds from your stated situation.";

  // Backup
  let backup: { title: string; summary: string; tradeOff: string };
  if (clinical) {
    backup = a.incomeNeed === "need_income"
      ? { title: "Degree route via student finance", summary: "Full-time study with student finance — slower-earning but a clear timeline.", tradeOff: "Several years on a low income before salaried work begins." }
      : { title: "Healthcare assistant role first, train later", summary: "Start earning in a related role, build relevant experience, then apply for training.", tradeOff: "Adds 1–2 years before training but improves your application and confidence." };
  } else if (teaching) {
    backup = { title: "PGCE with bursary (if eligible)", summary: "One-year postgraduate teacher training with government bursaries in shortage subjects.", tradeOff: "Limited income during the training year and intensive placements." };
  } else if (trade) {
    backup = { title: "Funded short course → assistant/trainee role", summary: "A funded Level 2 course can open trainee work that leads to a full apprenticeship.", tradeOff: "Slower progression to qualified status than a direct apprenticeship." };
  } else {
    backup = { title: "Self-study + entry-level role", summary: "Build portfolio evidence and target trainee or junior roles.", tradeOff: "Slower and less structured than a formal training route." };
  }

  // Avoid
  const tight = a.budget === "zero" || a.budget === "under_500";
  let avoid: { title: string; whyRisky: string; whenItMightWork: string };
  if (clinical) {
    avoid = { title: "An unregulated private course that does not lead to UK registration", whyRisky: "Some private courses are not recognised by the UK regulator and will not let you practise.", whenItMightWork: "Only if it explicitly leads to a regulator-approved qualification — confirm before paying." };
  } else if (teaching) {
    avoid = { title: "Unaccredited online \"teach abroad\" certificates", whyRisky: "They don't lead to Qualified Teacher Status in the UK.", whenItMightWork: "Only if you specifically want to teach abroad and have checked the destination's requirements." };
  } else if (tech) {
    avoid = { title: tight ? "A self-funded bootcamp on credit" : "A short bootcamp as the entire route", whyRisky: tight ? "Bootcamp fees on credit can mean repayments before employment, and many hiring teams now look beyond bootcamps alone." : "A bootcamp can be useful as one step, but rarely replaces structured experience for getting hired.", whenItMightWork: "If it is employer-funded, leads directly to a paid role, or you already have related experience." };
  } else {
    avoid = { title: "A long, expensive private course before checking employer demand", whyRisky: "Spending money on training before confirming real local demand often leads to a slow start or a pivot.", whenItMightWork: "If you've already spoken to employers in your area and they confirm they hire this route." };
  }

  // Immediate action
  const first = j.rules[0]?.id;
  let immediate: string;
  if (first === "blocker_no_gcse_clinical" || first === "blocker_no_gcse_teaching") {
    immediate = "Look up Functional Skills English and maths Level 2 with a local FE college this week.";
  } else if (first === "bridge_unsure_gcse") {
    immediate = "Find one specific course or employer's listing and check exactly which English and maths qualifications they accept.";
  } else if (first === "bridge_level_2_only") {
    immediate = "Check Access to Higher Education diplomas at colleges in your area.";
  } else if (first === "bridge_unrelated_graduate" && clinical) {
    immediate = "Apply for a healthcare assistant role at a local NHS trust to build relevant experience.";
  } else if (first === "bridge_unrelated_graduate" && teaching) {
    immediate = "Apply for a teaching assistant role at a school you could see yourself teaching at.";
  } else if (first === "blocker_money_time_income" || (a.incomeNeed === "need_income" && trade)) {
    immediate = "Search apprenticeship vacancies on the government's Find an Apprenticeship service.";
  } else if (a.incomeNeed === "need_income") {
    immediate = "Search apprenticeship and trainee vacancies on the government's Find an Apprenticeship service.";
  } else if (clinical) {
    immediate = "Browse approved courses on the NHS Health Careers website.";
  } else if (teaching) {
    immediate = "Browse routes into teaching on the Get Into Teaching website.";
  } else if (trade) {
    immediate = "Search apprenticeship vacancies on the government's Find an Apprenticeship service.";
  } else if (tech) {
    immediate = "Find one entry-level role spec online and list the gaps between it and your current skills.";
  } else {
    immediate = "Find a real job listing for this role and use its requirements as your study plan.";
  }

  const firstMoves = [immediate];
  if (j.rules[1]) {
    firstMoves.push(j.rules[1].id.startsWith("blocker_")
      ? "Map out a realistic timeline to address the second blocker before applying."
      : "Plan how you'll cover the second concern listed above in the next month.");
  } else if (a.region === "other_uk") {
    firstMoves.push("Search for one local employer or training provider in your area and note their entry requirements.");
  } else {
    firstMoves.push("Save one current job listing for this role so you can match your training plan to real requirements.");
  }
  firstMoves.push("Come back and rerun your Reality-check when your situation changes (qualifications, budget, hours).");

  const blocker = j.rules[0]?.message ?? "No single structural blocker stood out from what you told us.";
  const reason =
    j.readiness === "ready_now" ? "Your stated situation lines up with this route's typical entry expectations." :
    j.readiness === "nearly_ready" ? "You're close — one or two things to plan around before committing." :
    j.readiness === "needs_bridging" ? "A clear bridging step is needed before this route's main entry point makes sense." :
    "Several structural blockers stand in the way of the main entry route right now.";
  const overall =
    j.readiness === "ready_now" ? "Realistic" :
    j.readiness === "nearly_ready" ? "Realistic but hard" :
    j.readiness === "needs_bridging" ? "Long shot" : "Probably not for you";

  return {
    readiness: j.readiness,
    readinessReason: reason,
    biggestBlocker: blocker,
    immediateAction: immediate,
    overallVerdict: overall,
    bestRoute: {
      title: bestTitle, summary, whyThisFits: why.slice(0, 3),
      estimatedTime: time, likelyCost: cost, mainDifficulty: hard, confidence: conf,
    },
    backupRoute: backup,
    routeToAvoid: avoid,
    firstMoves: firstMoves.slice(0, 3),
  };
}
