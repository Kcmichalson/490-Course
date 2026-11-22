# Release checklist (1.0 by Dec 6)

Schedule: plans/m4-plan.md. Kc does every upload and every public step.

## Name (by about Dec 3)
- [ ] **Decide the release name** (Kc).
- [ ] Replace `{{DECIDED_MOD_NAME}}` in every file in `release/` at once.
- [ ] Set the launcher title and description in
      `mod/X2TacticalCoop/X2TacticalCoop.x2proj` (Name, Description). The
      folder, package and class names stay X2TacticalCoop / X2TC.

## Build
- [ ] 0.8.0 and 0.8.1 checklists passed; results in LOG.md with build IDs.
- [ ] Fix D: kept or removed (0.8.1 decision).
- [ ] Decide whether the M2 main-menu MULTIPLAYER button ships.
- [ ] Full code audit done (plans/m4-plan.md, "Code audit before 1.0");
      findings in LOG.md, and any fixes Kc approves are built and tested.
- [ ] Version set to 1.0.0 (`X2DownloadableContentInfo_X2TacticalCoop.uc`).
- [ ] `SHOW_TEST_BUTTONS` is false (`X2TC_MainMenuListener.uc`).
- [ ] Release-candidate friend playtest (~Dec 1-3); feedback in LOG.md in
      their words.

## Page
- [ ] Fill in `{{CONFIRM_AFTER_CAMPAIGN_TEST}}`, `{{LINK_TO_FRIEND_SETUP}}`,
      `{{WORKSHOP_LINK}}`, `{{VERSION}}`, `{{CREDITS}}` and the known issues
      (Kc decides the credits).
- [ ] Free, unofficial, not endorsed: the line is on the page. No
      donation or payment links anywhere.
- [ ] Compatibility section names the class override.
- [ ] Preview image: Kc's own screenshot, kept in `local/` (not committed).

## Publish (Kc)
- [ ] Upload to the Workshop; the Highlander listed as a required item.
- [ ] Subscribe from a clean setup and run one mission to check it loads.
- [ ] Record the Workshop link and build ID in LOG.md.
