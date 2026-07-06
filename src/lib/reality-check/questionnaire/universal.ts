// Universal questions — shared across roles that opt in by referencing the id
// from their RoleConfig.questionIds. Machine values are stable; labels can be
// refined without breaking persisted drafts or saved decisions.

import type { Question } from "./types";

export const startingPointQuestion: Question = {
  id: "starting_point",
  phase: "starting_point",
  title: "Where are you starting from?",
  helpText: "Choose the option that best describes you right now.",
  whyWeAsk:
    "Your starting point affects which routes may be open to you and whether your previous experience could help.",
  controlType: "single_select",
  options: [
    { value: "still_at_school",         label: "I'm still at school or college" },
    { value: "recently_left_education", label: "I've recently left education" },
    { value: "career_changer",          label: "I'm changing career" },
    { value: "construction_or_trade",   label: "I already work in construction or another skilled trade" },
    { value: "some_electrical_work",    label: "I already do some electrical work" },
    { value: "returning_after_break",   label: "I'm returning to work after a break" },
    { value: "none_fit",                label: "None of these quite fit" },
    { value: "not_sure_yet",            label: "I'm not sure yet" },
  ],
  conditionalField: {
    showWhenValueIn: ["none_fit"],
    label: "Tell us briefly where you're starting from.",
    placeholder: "e.g. between roles after a career break",
    hint: "We'll show this on your review but won't use it to decide your route.",
  },
};

export const trainingBudgetQuestion: Question = {
  id: "training_budget",
  phase: "practical_constraints",
  title: "What could you realistically afford to pay towards training?",
  helpText:
    "Think about course fees, required equipment and assessments. Do not include your normal living costs.",
  whyWeAsk:
    "Training routes can have very different costs. We use this to avoid presenting unaffordable routes as though they are realistic options — never to judge whether you're suited to the role.",
  controlType: "single_select",
  options: [
    { value: "free_only",     label: "It would need to be free or fully funded" },
    { value: "up_to_500",     label: "Up to £500" },
    { value: "500_to_2000",   label: "£500–£2,000" },
    { value: "over_2000",     label: "More than £2,000" },
    { value: "depends",       label: "It depends on what the cost includes" },
    { value: "not_sure",      label: "I'm not sure yet" },
  ],
};

export const travelRangeQuestion: Question = {
  id: "travel_range",
  phase: "practical_constraints",
  title: "How far could you regularly travel for training or work?",
  whyWeAsk:
    "Training providers, apprenticeships and work sites may not all be in the same place. Your travel range affects which opportunities are genuinely practical.",
  controlType: "single_select",
  options: [
    { value: "local_no_car",  label: "I need somewhere local that I can reach without a car" },
    { value: "up_to_30",      label: "Up to around 30 minutes each way" },
    { value: "up_to_60",      label: "Up to around one hour each way" },
    { value: "wider_area",    label: "I could travel across a wider area" },
    { value: "can_relocate",  label: "I could relocate for the right route" },
    { value: "depends",       label: "It would depend on the schedule" },
    { value: "not_sure",      label: "I'm not sure yet" },
  ],
};

export const routePrioritiesQuestion: Question = {
  id: "route_priorities",
  phase: "practical_constraints",
  title: "What matters most when choosing your route?",
  helpText: "Choose up to two.",
  whyWeAsk:
    "Several routes may be possible, but they will not all suit your priorities equally. We use this to rank realistic options, not to override entry requirements.",
  controlType: "multi_select",
  maxSelections: 2,
  options: [
    { value: "fit_around_commitments", label: "Fitting training around my existing commitments" },
    { value: "low_cost",               label: "Keeping training costs low" },
    { value: "earn_while_training",    label: "Earning while I train" },
    { value: "qualify_quickly",        label: "Qualifying as quickly as realistically possible" },
    { value: "practical_experience",   label: "Getting practical experience while training" },
    { value: "close_to_home",          label: "Finding something close to home" },
    { value: "recognised_qualification", label: "Gaining a recognised qualification" },
    { value: "strongest_employment",   label: "Having the strongest chance of employment afterwards" },
    { value: "not_sure_yet",           label: "I'm not sure yet", exclusive: true },
  ],
};
