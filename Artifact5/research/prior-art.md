# Prior art: XCOM 2 multiplayer and co-op

Researched 2026-11-08 to 11-09. Re-check anything time-sensitive before
relying on it.

## Official multiplayer
- Firaxis retired XCOM 2 multiplayer and Challenge Mode on Steam on
  March 28, 2022.
- Restoring it: Steam > XCOM 2 > Properties > Betas > "pre-21.10-support -
  support branch". Matches are peer-to-peer. The old custom match screen
  had public lobby, private lobby and LAN options.

## [WOTC] Modern Multiplayer Mod (Mr.Fear)
- Steam Workshop page (link: https://steamcommunity.com/sharedfiles/filedetails/?id=3066536619)
- Active (updates in November 2026). 1v1 PvP on the beta branch: 28 new
  units, bug fixes, rebalancing. Community and tournaments in a Steam group,
  "XCOM 2 WotC Multiplayer Tournaments".
- Its page warns multiplayer breaks with the developer console enabled,
  edited configs, or a DLC list that doesn't match the opponent's.
- Author's comments: more than two players isn't possible through a
  Workshop mod; the network code internals aren't accessible to modders;
  a co-op mode (two players vs. a bot on a random mission) is a future idea.
- Steam chat with Kc, 2026-11-09: see LOG.md.

## XCOM 2: Tactical Co-Op (Team Dragonpunk / Quixotic Cloud Games)
- https://steamcommunity.com/sharedfiles/filedetails/?id=792693587
- Released November 2016, last updated September 2017, status "Final".
  Two-player tactical co-op as a beta; didn't work with turn timers or
  Ironman. A later update let players import soldiers from a friend's game.
  The page says "Final (Unless Firaxis accepts the code changes we
  submited)", which suggests they hit limits a mod couldn't get past.
- Now marked incompatible; recent comments say no version of the game
  runs it. Source never published.
- The 2016 dispute: the team planned a Kickstarter for a paid standalone
  "fan expansion" using the XCOM IP and petitioned for Firaxis's blessing,
  proposing to send the money to Firaxis. Take-Two declined by phone.
  Whether it was a formal cease and desist is disputed; a former member
  said they were told only not to ask Firaxis/2K for support and not to
  solicit money. The team stopped XCOM 2 modding and moved to ARK. A
  planned four-player Long War 2 co-op was dropped. Source: ModDB news,
  "XCOM 2 'Fan Expansion' Modders Receive Cease And Desist From Take Two".
- Contrast: 2K approached Long War Studios (Pavonis) under NDA to make
  day-one mods; Long War 2 stayed free.

## WOTC Co-op Campaign (EvilMask587)
- https://github.com/EvilMask587/xcom2-wotc-coop-campaign
- Prototype, strategy layer only, no tactical co-op, not playable. Tested
  with two game instances on one PC over 127.0.0.1 on Steam build 8270065.
- License: not checked yet. Check before reusing any code.

## Co-op Anything directory
- https://github.com/cranebeaker/coop-anything
- Lists only the two XCOM 2 projects above (October 2026). Genre references
  worth reading: BattleTech co-op (alpha, turn-based tactics, Steam relay)
  and Fallout Tactics co-op (playable, two to four players).

## Other
- OpenXcom Coop Mod (for the 1994 game): a finished co-op design to learn
  from (teammate activity indicator, voting to abandon missions).
- Players today use Parsec or Steam Remote Play for co-op: one mouse and
  keyboard, latency.
