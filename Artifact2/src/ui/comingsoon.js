// Milestone gating: features from later milestones are shown disabled with
// "coming in M#". Bump CURRENT_MILESTONE when a milestone is finished.

export const CURRENT_MILESTONE = 1;

export function isAvailable(milestone = 1) {
  return milestone <= CURRENT_MILESTONE;
}

export function comingSoonText(milestone) {
  return `Coming in M${milestone}`;
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
