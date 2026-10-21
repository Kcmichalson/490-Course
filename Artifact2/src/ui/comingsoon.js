// Milestone gating: features from later milestones are shown disabled with
// "coming in M#". Milestone ids come from one ordered list; registries may
// use numbers (3) or strings ('2a'). Bump CURRENT_MILESTONE when a milestone
// is finished.

export const MILESTONES = ['1', '2a', '2b', '3', '4', '4b', '5', '6', '7', '8', '9', '10', '11'];

export const CURRENT_MILESTONE = '5';

export function milestoneIndex(milestone) {
  return MILESTONES.indexOf(String(milestone));
}

// Unknown ids count as unavailable.
export function isAvailable(milestone = '1') {
  const i = milestoneIndex(milestone);
  return i !== -1 && i <= milestoneIndex(CURRENT_MILESTONE);
}

export function milestoneLabel(milestone) {
  return `M${String(milestone).replace(/-\d+$/, '')}`;
}

export function comingSoonText(milestone) {
  return `Coming in ${milestoneLabel(milestone)}`;
}

// Disables a control and explains why in its tooltip.
export function applyComingSoon(el, milestone, label = '') {
  if (isAvailable(milestone)) return false;
  el.disabled = true;
  el.setAttribute('aria-disabled', 'true');
  el.classList.add('is-coming');
  el.title = label ? `${label} — ${comingSoonText(milestone).toLowerCase()}` : comingSoonText(milestone);
  return true;
}
