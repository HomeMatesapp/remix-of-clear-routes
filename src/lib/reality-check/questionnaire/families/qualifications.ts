// Shared qualifications questions — reusable across roles.
//
// maths_english_status lives here because most skilled-trade and technical
// roles have some maths/English entry requirement expectation, so the same
// question is genuinely reusable.

import type { Question } from "../types";

export const mathsEnglishQuestion: Question = {
  id: "maths_english_status",
  phase: "qualifications",
  title: "Which best describes your maths and English qualifications?",
  whyWeAsk:
    "Some training providers and apprenticeships have maths and English entry requirements. Missing qualifications do not necessarily prevent you from entering this role, but they may affect the route or additional study required.",
  controlType: "single_select",
  options: [
    { value: "both",          label: "I have both maths and English" },
    { value: "maths_only",    label: "I have maths but not English" },
    { value: "english_only",  label: "I have English but not maths" },
    { value: "neither",       label: "I do not have either" },
    { value: "international", label: "I have qualifications from outside the UK" },
    { value: "not_sure",      label: "I'm not sure" },
  ],
};
