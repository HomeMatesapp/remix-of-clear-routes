import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evaluateGenericPack } from "./_generic_pack.ts";
import type { RealityCheckResultV1 } from "../_shared/career-evaluator/v1/types.ts";

const PACK_PATH = new URL("../../../../content/career-packs/photographer/1.0.0.json", import.meta.url);
const pack = JSON.parse(await Deno.readTextFile(PACK_PATH));

Deno.test("photographer — strong-portfolio freelance evaluates under Deno", () => {
  const r = evaluateGenericPack(pack, {
    starting_point: "career_changer",
    portfolio_strength: "strong_diverse",
    equipment_access: "own_pro_kit",
    startup_budget: "modest",
    income_stability_need: "tolerate_variable",
    business_admin_confidence: "willing_to_learn",
    travel_flexibility: "yes_national",
    chosen_specialism: "yes_clear",
    willing_assistant_work: "yes",
    formal_qualification_status: "none",
  });
  assertEquals(r.schemaVersion, "reality-check-result/v1");
  assertEquals(r.slug, "photographer");
  assertEquals(r.regulatoryStatus, "not_formally_regulated");
  const top = r.routes[0];
  assertEquals(top.routeId, "portfolio_led_freelance");
  assert(r.considerations.some((c) => c.toLowerCase().includes("no mandatory qualification")));
});

Deno.test("photographer — no portfolio and minimal budget blocks freelance but not study", () => {
  const r = evaluateGenericPack(pack, {
    starting_point: "no_background",
    portfolio_strength: "none",
    equipment_access: "no_access",
    startup_budget: "minimal",
    income_stability_need: "need_stable",
    business_admin_confidence: "willing_to_learn",
    travel_flexibility: "local_only",
    chosen_specialism: "unsure",
    willing_assistant_work: "yes",
    formal_qualification_status: "none",
  });
  const study = r.routes.find((x) => x.routeId === "formal_study_plus_portfolio")!;
  assert(study.classification !== "not_currently_available_to_you");
  const freelance = r.routes.find((x) => x.routeId === "portfolio_led_freelance")!;
  assertEquals(freelance.classification, "not_currently_available_to_you");
});
