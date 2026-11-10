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
- **License: MIT**, "Copyright (c) 2026 EvilMask587" (the repo's LICENSE
  file, which Kc downloaded and shared on 2026-11-09). Its build scripts are
  X2ModBuildCommon (MIT, same as ours).
- **How it was made:** its README says it was "Built with the Co-op
  Anything playbook". Kc (2026-11-09): the GitHub repo lists one
  contributor, Claude. So it was most likely built by an AI agent. The
  README doesn't say so itself.

### What its README says (read 2026-11-09, from Kc's downloaded copy)
Everything here is their claim, from their README. **We haven't tested
any of it.**
- **Tested on:** Steam build 8270065 (changelist 699444), War of the Chosen
  with all DLC, Windows 10, two instances on one PC over 127.0.0.1. Not
  tested between two PCs or over Steam networking.
- **Join:** the host sends its whole campaign history and the client opens
  the Avenger from it through the load-game path. Joining is driven by
  their test bot, which sends the history with `MPSendHistory`; there's no
  join menu. `MPSendHistory` is a developer-console command in the SDK
  (`XComGame\Classes\XComCheatManager.uc` L4017–4022, which calls
  `NetworkMgr.SendHistory(...)`). So their test runs used the console,
  which Mr.Fear says breaks multiplayer and our CLAUDE.md rules out.
- **Direct IP only.** The host address has to be passed as one decimal
  integer, because "the engine's IpNetDriverSteamworks does not parse a
  dotted host".
- **"Baton":** one player at a time may change the campaign. The holder's
  new frames go to the partner as merge game states with a fingerprint,
  and a request/grant/ack handoff passes the baton. Screens that change the
  campaign need the baton.
- **ObjectID collisions:** the player without the baton can't create game
  state objects, "otherwise both sides would hand out the same ObjectID".
- **Lost frames:** frames sent one by one in bursts were lost by the
  network layer. Fix: batch frames made within 0.2 s into one merge state,
  keep one merge in flight, and have the receiver acknowledge each one
  (resent after 5 s without an ack). A second batch sent 0.23 s after the
  first was lost.
- **History alignment:** the receiver adds empty frames so a merge lands at
  the same frame number as the sender's. Without that the host crashed in
  5 of 11 runs of one test.
- **Saves:** only the host saves; a client that saved while sending
  crashed.
- **Client drop and rejoin** works (the host takes the baton back). A host
  drop isn't handled.
- **Test setup:** a separate copy of the game, never the install they play.
  The second instance is a hard-link clone with its own config. Both run
  with `-nohomedir` "so saves/config/logs stay inside the copies". Running
  two instances on one PC needs a mutex handle closed with Sysinternals
  `handle64.exe` (an outside tool).
- **Known issues** include popups appearing only for one player, one
  unexplained client crash, and the list of edit screens being a first
  guess.

Relevance to us: it's strategy-layer only, but its network findings
(direct IP format, lost bursts, ObjectID collisions, history alignment)
are about the same network manager our tactical co-op will use. Their
fixes are a starting point to test, not facts. Reusing any of their code
is allowed by MIT (keep their copyright notice), but propose it in a plan
first.

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
