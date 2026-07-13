// One-shot generator for immutable 1.1.0 pack files.
// Reads the byte-immutable 1.0.0 pack and layers additive v1.1 content
// (careerIdentity intro/coverage, questionModules, enriched questionRefs).
// The 1.0.0 files are NEVER touched.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const load10 = (slug) =>
  JSON.parse(readFileSync(resolve(ROOT, `content/career-packs/${slug}/1.0.0.json`), "utf-8"));

// ── Human-readable option labels reused across packs ────────────────────────
const optLabels = {
  yes: "Yes",
  no: "No",
  not_sure: "Not sure",
  prefer_not_say: "Prefer not to say",
  none: "None",
  possible: "Possibly",
  partial: "Partly",
  international: "I have international qualifications",
};
const opt = (value, label, description) =>
  description ? { value, label, description } : { value, label };

const build = (base, enrich) => {
  const p = JSON.parse(JSON.stringify(base));
  p.packVersion = "1.1.0";
  p.careerIdentity.introduction = enrich.introduction;
  p.careerIdentity.whatItCovers = enrich.whatItCovers;
  p.careerIdentity.whatItCannotConfirm = enrich.whatItCannotConfirm;
  p.questionModules = enrich.questionModules;
  p.questionRefs = p.questionRefs.map((q) => {
    const en = enrich.questions[q.id];
    if (!en) throw new Error(`missing enrichment for ${q.id}`);
    const opts = en.options ?? q.allowedValues.map((v) => opt(v, optLabels[v] ?? v));
    for (const o of opts) if (!q.allowedValues.includes(o.value))
      throw new Error(`option ${o.value} not in allowedValues of ${q.id}`);
    for (const v of q.allowedValues) if (!opts.some((o) => o.value === v))
      throw new Error(`allowedValue ${v} has no option label for ${q.id}`);
    return {
      ...q,
      displayLabel: en.displayLabel ?? q.label,
      helpTextLong: en.helpTextLong,
      options: opts,
      required: en.required ?? true,
      moduleId: en.moduleId,
      ...(en.visibleWhen ? { visibleWhen: en.visibleWhen } : {}),
    };
  });
  p.contentReview = {
    ...p.contentReview,
    lastReviewedAt: "2026-07-13",
    sourcesAsOf: p.contentReview.sourcesAsOf,
  };
  return p;
};

// ══════════════════════════════════════════════════════════════════════════
// MIDWIFE 1.1.0
// ══════════════════════════════════════════════════════════════════════════
const midwifeEnrich = {
  introduction:
    "Midwife is a statutorily regulated profession in England. You must be on the Nursing and Midwifery Council (NMC) register (midwives part) to practise. This Reality Check helps you see which entry route currently looks most workable for you given your starting point, and what would need to be true before you could apply.",
  whatItCovers: [
    "Whether the three main NMC-approved entry routes are currently open to you.",
    "The statutory registration requirement and how it applies to every route.",
    "Practical fit factors such as full-time placements, income need and enhanced DBS.",
    "The immediate, verifiable next steps you can take this month.",
  ],
  whatItCannotConfirm: [
    "Whether any specific university will accept your exact qualifications — always confirm on their course page.",
    "Whether an occupational-health condition would affect fitness to practise in your case — the provider's occupational-health service decides.",
    "Your personal likelihood of receiving an offer from any given provider.",
    "Regulations, funding or approved programmes outside England.",
  ],
  questionModules: [
    { id: "starting_point", title: "Your starting point", description: "How you're coming into midwifery." },
    { id: "formal_readiness", title: "Formal qualifications and registration", description: "The regulator-set entry requirements for each route." },
    { id: "practical_fit", title: "Practical fit", description: "Placements, DBS and occupational-health factors." },
    { id: "income_and_life", title: "Income and study capacity", description: "Money and time you can commit while training." },
  ],
  questions: {
    starting_point: {
      moduleId: "starting_point",
      helpTextLong: "There is no single right starting point. This lets us weigh the shortened routes correctly.",
      options: [
        opt("school_leaver", "School or college leaver"),
        opt("graduate", "Graduate in another subject"),
        opt("registered_nurse", "Registered adult nurse (already on the NMC register)"),
        opt("career_changer", "Changing career from an unrelated job"),
        opt("no_background", "None of the above / just exploring"),
      ],
    },
    gcse_maths_english_science_status: {
      moduleId: "formal_readiness",
      helpTextLong: "Most NMC-approved BSc courses expect GCSE grade 4/C or equivalent in maths, English and a science.",
      options: [
        opt("yes", "Yes, all three"),
        opt("partial", "I have some but not all three"),
        opt("no", "No, I don't have these yet"),
        opt("not_sure", "Not sure"),
        opt("international", "I have international qualifications"),
      ],
    },
    level3_status: {
      moduleId: "formal_readiness",
      helpTextLong: "This includes A-levels, T Levels, or an Access to Higher Education Diploma.",
      options: [
        opt("yes_science", "Yes, including a science subject"),
        opt("yes_no_science", "Yes, but without a science subject"),
        opt("in_progress", "I'm currently working towards one"),
        opt("no", "No, I don't have a Level 3 qualification"),
        opt("international", "I have international qualifications"),
      ],
    },
    relevant_first_degree_status: {
      moduleId: "formal_readiness",
      helpTextLong: "The MSc pre-registration route typically requires a 2:1 or above in a health or science subject.",
      required: false,
      visibleWhen: [{ questionId: "starting_point", op: "in", value: ["graduate", "career_changer", "registered_nurse"] }],
      options: [
        opt("yes_relevant", "Yes, in a relevant health or science subject"),
        opt("yes_unrelated", "Yes, but in an unrelated subject"),
        opt("in_progress", "I'm currently studying one"),
        opt("no", "No, I don't have a first degree"),
      ],
    },
    current_registration: {
      moduleId: "formal_readiness",
      helpTextLong: "The shortened conversion route is only for nurses already on the NMC adult-nursing register.",
      required: false,
      visibleWhen: [{ questionId: "starting_point", op: "in", value: ["registered_nurse", "career_changer"] }],
      options: [
        opt("yes", "Yes, I'm on the adult-nursing part of the NMC register"),
        opt("no", "No"),
      ],
    },
    income_need: {
      moduleId: "income_and_life",
      helpTextLong: "The NHS Learning Support Fund provides a non-repayable grant of at least £5,000 per year for eligible students in England.",
      options: [
        opt("need_income", "I need income while studying"),
        opt("can_study_full_time", "I can study full time without paid work"),
        opt("part_time_ok", "I could combine study with limited part-time work"),
      ],
    },
    weekly_placement_hours: {
      moduleId: "practical_fit",
      helpTextLong: "NMC-approved programmes require full-time clinical placements including night and weekend shifts. This is a regulator requirement, not a provider choice.",
      options: [
        opt("yes", "Yes, I can commit to full-time placements"),
        opt("with_planning", "Yes, with some planning around other commitments"),
        opt("no", "No, I cannot commit to full-time placements"),
      ],
    },
    dbs_check_barriers: {
      moduleId: "practical_fit",
      helpTextLong: "Answer honestly — this only affects whether we suggest specialist advice, never eligibility on its own.",
      options: [
        opt("none", "No factors I'm aware of"),
        opt("possible", "There may be factors I'd want to check"),
        opt("prefer_not_say", "Prefer not to say"),
      ],
    },
    occupational_health_concerns: {
      moduleId: "practical_fit",
      helpTextLong: "All routes require occupational-health clearance after a conditional offer.",
      options: [
        opt("none", "No conditions I'd need to check"),
        opt("possible", "There may be a condition to check with occupational health"),
        opt("prefer_not_say", "Prefer not to say"),
      ],
    },
  },
};

// ══════════════════════════════════════════════════════════════════════════
// CARPENTER / JOINER 1.1.0
// ══════════════════════════════════════════════════════════════════════════
const carpenterEnrich = {
  introduction:
    "There is no protected title or statutory register for carpenters or joiners in England — you don't need a specific qualification to do the work. This Reality Check helps you weigh three real entry routes (employed apprenticeship, college plus workplace experience, or the experienced-worker NVQ) against your practical starting point.",
  whatItCovers: [
    "Which of the three recognised routes into carpentry and joinery are currently workable for you.",
    "Whether an employer/apprenticeship offer is in place or actively being sought.",
    "Practical-fit factors: site work, travel, physical capacity, tools and income need.",
    "Concrete next actions such as searching find-an-apprenticeship or starting an OSAT portfolio.",
  ],
  whatItCannotConfirm: [
    "Whether a specific employer will offer you an apprenticeship place — only that employer can decide.",
    "Whether an OSAT assessment centre will accept your existing evidence — the centre decides after review.",
    "Local availability of specific college courses or apprenticeship vacancies at the time you apply.",
    "Whether a CSCS card will be required by a specific site (this is an industry scheme, not a legal licence).",
  ],
  questionModules: [
    { id: "starting_point", title: "Your starting point" },
    { id: "formal_readiness", title: "Formal readiness", description: "English, maths and any recognised prior work." },
    { id: "practical_fit", title: "Practical fit", description: "Physical capacity, travel and tools." },
    { id: "income_and_local", title: "Income and local availability" },
  ],
  questions: {
    starting_point: {
      moduleId: "starting_point",
      helpTextLong: "This helps us weigh apprenticeship, college and experienced-worker routes correctly.",
      options: [
        opt("school_leaver", "School or college leaver"),
        opt("career_changer", "Changing career from an unrelated job"),
        opt("some_experience_no_evidence", "I do some carpentry/joinery work but have no formal evidence"),
        opt("tradesperson_other", "I already work in a related trade"),
      ],
    },
    english_maths_status: {
      moduleId: "formal_readiness",
      helpTextLong: "Apprentices must reach Functional Skills Level 2 (or GCSE 4/C) in English and maths before end-point assessment.",
      options: [
        opt("yes_level2", "Yes — GCSE 4/C or Functional Skills Level 2"),
        opt("working_towards", "Working towards it"),
        opt("no", "No, I don't have these yet"),
        opt("not_sure", "Not sure"),
      ],
    },
    has_employer_offer: {
      moduleId: "formal_readiness",
      helpTextLong: "An apprenticeship is an employed job. Without an employer it cannot start.",
      options: [
        opt("yes_have_offer", "Yes, I have or expect a place"),
        opt("actively_looking", "I'm actively looking for one"),
        opt("no_and_unsure", "No, and I haven't started looking"),
      ],
    },
    documented_work_evidence: {
      moduleId: "formal_readiness",
      helpTextLong: "The OSAT (experienced worker) route relies on evidence of real work — photos, employer statements, drawings.",
      required: false,
      visibleWhen: [
        { questionId: "starting_point", op: "in", value: ["some_experience_no_evidence", "tradesperson_other", "career_changer"] },
      ],
      options: [
        opt("yes_substantial", "Yes, substantial evidence of real work"),
        opt("some_photos", "Some photos or partial evidence"),
        opt("none", "No documented evidence"),
        opt("prefer_not_say", "Prefer not to say"),
      ],
    },
    physical_capacity: {
      moduleId: "practical_fit",
      helpTextLong: "Every route involves practical work — manual handling, working at height, using power tools.",
      options: [
        opt("yes_confident", "Yes, I'm confident about the physical demands"),
        opt("some_limits", "Some limits I'd want to plan around"),
        opt("unable", "I can't do sustained physical site work"),
      ],
    },
    travel_capability: {
      moduleId: "practical_fit",
      helpTextLong: "Site carpentry commonly involves travel; workshop bench joinery is often less travel-heavy.",
      options: [
        opt("yes_reliable_transport", "Yes, I have reliable transport"),
        opt("limited_to_local", "Only within my local area"),
        opt("cannot_travel", "I can't travel between sites"),
      ],
    },
    tool_budget: {
      moduleId: "practical_fit",
      helpTextLong: "Colleges and site work usually expect a basic personal tool kit.",
      options: [
        opt("employer_provides", "An employer would provide them"),
        opt("can_invest", "I can invest in a basic kit"),
        opt("minimal_budget", "I have a minimal budget for tools"),
      ],
    },
    income_need: {
      moduleId: "income_and_local",
      helpTextLong: "Apprentices are paid at least the Apprentice National Minimum Wage; this is typically well below a full trades wage in year 1.",
      options: [
        opt("need_full_wage", "I need a full trades wage"),
        opt("can_apprentice_wage", "I can accept apprentice-level pay"),
        opt("some_savings", "I have some savings to bridge the training period"),
      ],
    },
    local_apprenticeship_known: {
      moduleId: "income_and_local",
      helpTextLong: "Availability changes throughout the year. The GOV.UK find-an-apprenticeship service lists current vacancies.",
      options: [
        opt("yes_found", "Yes, I've found local vacancies"),
        opt("not_sure", "I haven't checked yet"),
        opt("none_found", "I've looked but found none locally"),
      ],
    },
    willing_workplace_evidence: {
      moduleId: "formal_readiness",
      helpTextLong: "College study alone doesn't produce a fully qualified carpenter or joiner — workplace evidence is expected.",
      options: [
        opt("yes", "Yes"),
        opt("unsure", "I'm not sure yet"),
        opt("no", "No"),
      ],
    },
  },
};

// ══════════════════════════════════════════════════════════════════════════
// PHOTOGRAPHER 1.1.0
// ══════════════════════════════════════════════════════════════════════════
const photographerEnrich = {
  introduction:
    "There is no protected title, mandatory qualification or statutory register for photographers in England. This Reality Check helps you weigh three practical routes (portfolio-led freelance, employed/assistant progression, or formal study combined with portfolio building) against your current portfolio, kit, budget and income needs — not against qualifications you don't legally need.",
  whatItCovers: [
    "Which of the three practical routes into photography are workable for you now.",
    "Portfolio, equipment and start-up budget as practical fit — not as eligibility barriers.",
    "Business-administration and insurance obligations that apply to self-employment.",
    "Concrete next actions to build a portfolio, test specialisms or map local clients.",
  ],
  whatItCannotConfirm: [
    "Your personal likelihood of winning specific clients or being hired by a specific studio.",
    "Whether any single specialism will be sustainable for you long-term.",
    "Insurance quotes or exact self-employment tax positions — check with an insurer and HMRC.",
    "Data-protection or safeguarding obligations for specific assignment types beyond the general guidance.",
  ],
  questionModules: [
    { id: "starting_point", title: "Your starting point" },
    { id: "portfolio_and_kit", title: "Portfolio and equipment" },
    { id: "business_and_income", title: "Business, income and travel" },
    { id: "study_and_specialism", title: "Study and specialism" },
  ],
  questions: {
    starting_point: {
      moduleId: "starting_point",
      helpTextLong: "There's no wrong starting point in photography — this just helps us weigh the practical routes.",
      options: [
        opt("school_leaver", "School or college leaver"),
        opt("career_changer", "Changing career from an unrelated job"),
        opt("adjacent_creative", "I already work in an adjacent creative field"),
        opt("no_background", "Just exploring / no background yet"),
      ],
    },
    portfolio_strength: {
      moduleId: "portfolio_and_kit",
      helpTextLong: "A working portfolio is what clients, employers and course tutors actually judge you on.",
      options: [
        opt("strong_diverse", "Strong and diverse — polished work in my specialism"),
        opt("growing", "Growing — some solid pieces, needs more depth"),
        opt("thin", "Thin — a few images but not client-ready"),
        opt("none", "No portfolio yet"),
      ],
    },
    equipment_access: {
      moduleId: "portfolio_and_kit",
      helpTextLong: "You need a usable camera and lenses appropriate to your specialism. Some assistant roles use studio kit.",
      options: [
        opt("own_pro_kit", "Own professional kit"),
        opt("own_entry_kit", "Own entry-level kit"),
        opt("borrowed_or_hire", "Borrowed or hired access"),
        opt("no_access", "No access to a camera"),
      ],
    },
    startup_budget: {
      moduleId: "business_and_income",
      helpTextLong: "Covers kit, insurance, software subscriptions, marketing and any tuition costs.",
      options: [
        opt("substantial", "Substantial — several thousand pounds"),
        opt("modest", "Modest — a few hundred pounds"),
        opt("minimal", "Minimal — very tight budget"),
      ],
    },
    income_stability_need: {
      moduleId: "business_and_income",
      helpTextLong: "Freelance income is typically irregular for the first years.",
      options: [
        opt("need_stable", "I need a stable monthly income"),
        opt("tolerate_variable", "I can tolerate variable income"),
        opt("either", "Either — I have flexibility"),
      ],
    },
    business_admin_confidence: {
      moduleId: "business_and_income",
      helpTextLong: "Self-employed photographers must handle invoicing, tax and insurance. This is a legal obligation.",
      options: [
        opt("confident", "Confident with self-employed admin"),
        opt("willing_to_learn", "Willing to learn"),
        opt("unwilling", "Unwilling to handle self-employed admin"),
      ],
    },
    travel_flexibility: {
      moduleId: "business_and_income",
      helpTextLong: "Some specialisms require regular travel and unsociable hours.",
      options: [
        opt("yes_national", "Yes — national travel is fine"),
        opt("local_only", "Local area only"),
        opt("limited", "Very limited travel"),
      ],
    },
    chosen_specialism: {
      moduleId: "study_and_specialism",
      helpTextLong: "Specialism examples: portrait, editorial, wedding, product, documentary.",
      required: false,
      visibleWhen: [{ questionId: "portfolio_strength", op: "in", value: ["strong_diverse", "growing", "thin"] }],
      options: [
        opt("yes_clear", "Yes, I have a clear specialism"),
        opt("exploring", "I'm exploring two or three"),
        opt("unsure", "Not sure yet"),
      ],
    },
    willing_assistant_work: {
      moduleId: "study_and_specialism",
      helpTextLong: "Progression into employed roles typically starts with assistant or second-shooter work.",
      options: [
        opt("yes", "Yes, I'm open to assistant work"),
        opt("prefer_paid_client_work", "I'd prefer paid client work from the start"),
        opt("no", "No"),
      ],
    },
    formal_qualification_status: {
      moduleId: "study_and_specialism",
      helpTextLong: "A qualification is NOT required to work as a photographer. This is only relevant to the formal-study route.",
      options: [
        opt("relevant_degree", "I have a relevant photography qualification"),
        opt("in_progress", "I'm currently studying one"),
        opt("none", "No formal photography qualification"),
      ],
    },
  },
};

const outputs = [
  { slug: "midwife", enrich: midwifeEnrich },
  { slug: "carpenter-joiner", enrich: carpenterEnrich },
  { slug: "photographer", enrich: photographerEnrich },
];

for (const { slug, enrich } of outputs) {
  const base = load10(slug);
  const built = build(base, enrich);
  const out = resolve(ROOT, `content/career-packs/${slug}/1.1.0.json`);
  writeFileSync(out, JSON.stringify(built, null, 2) + "\n", "utf-8");
  console.log(`wrote ${out}`);
}
