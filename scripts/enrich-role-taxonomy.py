#!/usr/bin/env python3
"""Enrich role-taxonomy.json with productProofValue (0|1|2).

Additive-only: reads existing role-taxonomy.json, adds the new rubric field
and recomputes priority using the extended scoring. Does not re-classify
families/archetypes/depth. Frozen roles keep their reviewed rubric.

Scoring (new):
  score = (regulated?2:0) + (expensiveWrongTurn?2:0) + routeConfusion
        + demandLikely + (highConsequenceAdvice?2:0) + 2*productProofValue
  Max = 14. Buckets:
    top_candidate  >= 10
    strong_cand.   6..9
    possible_later 2..5
    not_priority   0..1
"""
import json, re, sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src/lib/roles/role-taxonomy.json"

def phrase(*ps):
    return re.compile(r"\b(?:" + "|".join(re.escape(p) for p in ps) + r")", re.I)

# --- productProofValue rules
# High-proof exemplars: each unlocks a distinct route-logic module Clear Routes
# does not yet have. Deliberately curated, not derived from regulation flags.
PROOF_2_NAME = phrase(
    "software engineer","software developer","full stack","web developer",
    "data scientist","data analyst","product manager","ux designer",
    "registered nurse","midwife","paramedic","clinical psychologist",
    "physiotherapist","pharmacist","dentist","veterinary surgeon",
    "police officer","firefighter","prison officer","border force officer",
    "royal navy officer","army officer","raf officer",
    "actor","musician","photographer","journalist","graphic designer",
    "author","fashion designer","film director","screenwriter",
    "airline pilot","commercial pilot","air traffic controller",
    "solicitor","barrister","chartered accountant","architect",
    "primary school teacher","secondary school teacher","social worker",
    "chef","personal trainer","counsellor","psychotherapist",
    "professional footballer","olympian","astronaut",
)

# Archetypes that carry logic Clear Routes hasn't proven yet (partial credit).
PROOF_1_ARCHETYPES = {
    "portfolio_led","licence_led","selection_led","commission_or_gig_led",
    "competitive_entry_led","regulated_registration_led","postgraduate_led",
}

# Skilled trades adjacency: Electrician/Plumber/HVAC already prove this logic.
def product_proof_value(entry):
    if entry["roleSlug"] in {"electrician","plumber","hvac-engineer"}:
        return 0  # already proven, not a next-build target
    if PROOF_2_NAME.search(entry["roleName"]):
        return 2
    fam = entry["primaryFamily"]
    arch = entry["routeArchetype"]
    if fam == "skilled_trades" and arch == "apprenticeship_led":
        return 0
    if arch in PROOF_1_ARCHETYPES:
        return 1
    return 0

def score(r):
    return ((2 if r["regulated"] else 0)
            + (2 if r["expensiveWrongTurn"] else 0)
            + r["routeConfusion"] + r["demandLikely"]
            + (2 if r["highConsequenceAdvice"] else 0)
            + 2 * r["productProofValue"])

def priority_from_score(s):
    if s >= 10: return "top_candidate"
    if s >= 6:  return "strong_candidate"
    if s >= 2:  return "possible_later"
    return "not_priority"

def main():
    data = json.loads(SRC.read_text())
    for e in data:
        r = e["deepCheckRubric"]
        if "productProofValue" not in r:
            r["productProofValue"] = product_proof_value(e)
        e["deepCheckPriority"] = priority_from_score(score(r))

    SRC.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")

    prio = Counter(e["deepCheckPriority"] for e in data)
    proof = Counter(e["deepCheckRubric"]["productProofValue"] for e in data)
    print(f"Total: {len(data)}  priority={dict(prio)}  productProof={dict(proof)}")

if __name__ == "__main__":
    main()
