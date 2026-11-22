# Workshop description (draft)

Draft for the Steam Workshop page. `{{DECIDED_MOD_NAME}}` is filled in once
the name is decided (release/release-checklist.md). The mod's folder and
code keep the name X2TacticalCoop. Steam formats pages with BBCode; convert
the headings when pasting.

---

## {{DECIDED_MOD_NAME}}

Two-player co-op for XCOM 2: War of the Chosen tactical missions, over
Steam or a direct connection. Both players share one XCOM squad, each
commands their own soldiers, and both can act during the same XCOM turn.
One action resolves at a time.

Free, unofficial, and not affiliated with or endorsed by Firaxis Games or
2K.

### How it works
- The **host** plays a normal game (a campaign mission or a Skirmish) and
  clicks **CO-OP: HOST (STEAM)** on the tactical screen to invite a Steam
  friend. On the same network, **CO-OP: HOST** and **CO-OP: JOIN** connect
  by IP address.
- The **partner** joins from the main menu and sees the same mission on
  their own screen, with their own camera, mouse and keyboard.
- On **CO-OP: SQUAD** the host gives each soldier to a player. Each player
  moves, shoots and uses abilities with their own soldiers. The host's game
  decides every roll; the partner's game follows it.
- XCOM's turn ends when the host ends it, or when nobody's soldiers can
  act. The partner's END TURN tells the host they're ready.
- The strategy layer (the Avenger) is the host's, as in single-player. The
  mission's results (XP, wounds, deaths, loot) stay in the host's campaign.
  {{CONFIRM_AFTER_CAMPAIGN_TEST}}

### Requirements
- XCOM 2: War of the Chosen on both PCs, the same game build.
- [WOTC] Community Highlander (X2WOTCCommunityHighlander).
- If you own Alien Hunters: the [WOTC] Alien Hunters Community Highlander
  too. Don't use it without Alien Hunters (its own page says so).
- **Both players need the same mods and DLC.** The mod checks this when the
  partner joins and names any difference.
- Exactly two players.

Setup steps for the partner: {{LINK_TO_FRIEND_SETUP}}.

### Compatibility
- This mod overrides one game class, `X2Action_CameraFollowUnit` (the
  camera that follows a moving soldier), so the partner's camera follows
  moves. Outside a co-op session it behaves exactly like the game's own.
  Another mod that overrides the same class will conflict with it.
- Everything else uses the game's own extension points and the Community
  Highlander.
- Multiplayer-style connections break with the developer console on or
  edited config files; play with a clean setup.
- If something misbehaves, **CO-OP: FIXES** on the tactical screen turns
  individual fixes off, or all of them at once with SAFE MODE.

### Known issues
{{PASTE_FROM_KNOWN_ISSUES}} (release/known-issues.md)

### Credits
{{CREDITS}}
