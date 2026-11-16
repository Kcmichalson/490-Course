# Keeping the guest's history in step (2026-11-15)

Research for the incremental-send plan (Kc: the friend found the game
"more unstable" as the mission went on). Paths are under the SDK's
`Development\SrcOrig\XComGame\Classes\` unless named; nothing here has been
tested; **guess** marks inference. Logs: `local\m3-logs\stage7-pc-2.log`
and `stage7-friend-2.log` (Stage 7 Run 2, 0.6.2, build 8270065 on the PC).

## What the mod does now
After the join, the host calls `SendPartialHistory` whenever its history
has new frames (one send at a time, each acknowledged by the guest).
`SendPartialHistory` is native. The class keeps `BaseHistoryData`, "Last
sent history data used for binary Delta updates"
(`XComGameStateNetworkManager.uc` L74). So each send probably serializes
the whole history and diffs it (sdk-findings.md finding 15).

## Measured in Run 2 (a 14-turn mission, 2407 frames)
- **Send size grows with the history**, not with the new frames:
  - 20 KB at the first send;
  - 208 KB for a 1-frame send at frame 1480;
  - 409 KB at frame 2345.
- **Acknowledgement times grew:** 0 s: 24, 1 s: 55, 2 s: 44, 3 s: 20,
  4 s: 11.
- **The guest stalled:** runs of five 1.5 s poll gaps at frames 718 and
  1974 (friend L2671-2675, L4485-4489).
- **1910 script stack traces in the host's log.** They come from
  `X2GameRuleset.SubmitGameStateContext` (1730), `XComWorldData.OnObjectMoved`
  (992) and others. The cause:
  - While the network manager has a connection, every submitted context
    whose `bSendGameState` is false logs "Did not Queue Context for
    Sending!!" and calls `ScriptTrace()` (`X2GameRuleset.uc` L237-249).
  - Contexts with `bSendGameState` true are queued to the peer instead
    (`QueueContextForSending`, L242). Moves made through
    `GameStateMoveUnit` set it (`XComTacticalController.uc` L1328), and so
    do HUD abilities (`UITacticalHUD_AbilityContainer.uc` L673) and end
    turn (`XGPlayer.uc` L440).
  - So during co-op the host probably also sends those input contexts to
    the guest (**guess**: the native side; the guest's ruleset can't add
    them in replay, `XComGameStateNetworkManager.uc` L295-305).

## Building blocks for sending only new frames
- `SendGameState(GameState, HistoryIndex)` and the receive delegate
  `OnReceiveGameState(GameState)` (L338-341).
- `SendMergeGameState(GameState)` and `OnReceiveMergeGameState` (L347-350).
  The lobby uses merges and plain game states for player updates
  (`UIMPShell_Lobby.uc` L772, L2029); its receive handlers only refresh the
  UI (L832-844). So the native side probably adds the received state to the
  history (**guess**; a test must show the guest's frame count).
- `SetPauseGameStateSending(bool)`: "keep the InputContext from being sent"
  (L127, L264-267).
- Prior art (README claims, not tested): the WOTC Co-op Campaign prototype
  sends merged states with batching, one merge in flight, an ack and a 5 s
  resend, and pads the receiver's history so frames land at the same index
  (sdk-findings.md, prototype section).

## Only a test can settle
- Whether a received `SendGameState` frame is added to the guest's history,
  at which index, and whether the follower can replay it like a partial
  history's frames.
- Frame alignment over many sends, and recovery after a lost or
  out-of-order frame.
- Whether pausing context sending changes anything for the guest.
- How much of the guest's stalling the per-frame approach removes.
