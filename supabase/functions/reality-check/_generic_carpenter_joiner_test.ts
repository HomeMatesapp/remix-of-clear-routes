import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evaluateGenericPack } from "../../reality-check/_generic_pack.ts";

const PACK_PATH = new URL("../../../../content/career-packs/carpenter-joiner/1.0.0.json", import.meta.url);
const pack = JSON.parse(await Deno.readTextFile(PACK_PATH));

Deno.test("carpenter-joiner — apprenticeship-ready school leaver evaluates under Deno", () => {
  const r = evaluateGenericPack(pack, {
    starting_point: "school_leaver",
    english_maths_status: "yes_level2",
    has_employer_offer: "yes_have_offer",
    documented_work_evidence: "none",
    physical_capacity: "yes_confident",
    travel_capability: "yes_reliable_transport",
    tool_budget: "employer_provides",
    income_need: "can_apprentice_wage",
    local_apprenticeship_known: "yes_found",
    willing_workplace_evidence: "yes",
  });
  assertEquals(r.schemaVersion, "reality-check-result/v1");
  assertEquals(r.slug, "carpenter-joiner");
  assertEquals(r.regulatoryStatus, "not_formally_regulated");
  assertEquals(r.geographicScope, ["England"]);
  assert(r.routes.length === 3);
});

Deno.test("carpenter-joiner — unable to do physical work blocks all routes", () => {
  const r = evaluateGenericPack(pack, {
    starting_point: "career_changer",
    english_maths_status: "yes_level2",
    has_employer_offer: "actively_looking",
    documented_work_evidence: "some_photos",
    physical_capacity: "unable",
    travel_capability: "yes_reliable_transport",
    tool_budget: "can_invest",
    income_need: "can_apprentice_wage",
    local_apprenticeship_known: "yes_found",
    willing_workplace_evidence: "yes",
  });
  const blocked = r.routes.filter((x) => x.classification === "not_currently_available_to_you").map((x) => x.routeId).sort();
  assertEquals(blocked, ["apprenticeship_l2_l3", "college_plus_experience", "experience_onsite_assessment"]);
});
