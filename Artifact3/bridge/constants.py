"""Tunable values and defaults. Every tunable lives here and nowhere else."""

# --- Network: local only. server.py refuses any other host. ---
HOST = "127.0.0.1"
PORT = 8765
MAX_BODY_BYTES = 1_000_000

# --- Versions ---
SCHEMA_VERSION = 2    # processed snapshot (snapshots/latest.json)
PAYLOAD_VERSION = 2   # raw payload the Lua exporter POSTs to /tts

# --- Storage (relative to Artifact3/; all git-ignored) ---
SNAPSHOT_DIR = "snapshots"
LATEST_FILE = "latest.json"
HISTORY_FILE = "history.jsonl"
CALIBRATION_FILE = "calibration.json"   # last valid calibration
LAST_PAYLOAD_FILE = "last_payload.json" # last raw POST body, for debugging

# --- Tracking marker: first non-blank description line "AIT: <kind>" ---
MARKER_KEY = "ait"
KINDS = ("unit", "terrain", "hazard", "objective", "calibration")

# --- TTS Grid settings (used only when there are no calibration markers) ---
# Grid.type → hex orientation. UNVERIFIED: which TTS hex type is pointy-top
# is a guess; check in TTS during M2. Type 1 (rectangles) is rejected.
GRID_TYPE_ORIENTATION = {2: "pointy", 3: "flat"}
# Which Grid offset fields are world X and world Z. UNVERIFIED (M2): TTS may
# use offsetY for the Z axis; the exporter sends every offset field raw.
GRID_OFFSET_X_FIELD = "offsetX"
GRID_OFFSET_Z_FIELD = "offsetZ"

# --- Calibration markers (user's rules, LOG.md Session 1, Prompt 16) ---
CALIBRATION_POINTS = ("origin", "a", "b")
CAL_SPACING_TOLERANCE = 0.03      # A and B per-hex spacing may differ by 3%
CAL_ANGLE_TOLERANCE_DEG = 3.0     # rows must be 60° or 120° apart, ±3°
# Keep the saved calibration if every marker is within this many hexes of
# its saved position, so a bumped marker can't shift any unit's hex.
CAL_MARKER_TOLERANCE_HEX = 0.25

# --- Motion (user's rule, Prompt 16) ---
# A marked unit that's held or not resting is in motion and holds back
# history, but for at most this long; then it's warned about and ignored.
MOTION_STALE_SECONDS = 30

# --- Footprints ---
# LANCER Size → occupied hexes, per the user's rule (LOG.md, Session 1,
# Prompts 2, 5, 7, 12, 13): Size 1/2 and 1 = 1 hex, 2 = 3 (triangle),
# 3 = 7 (flower), 4 = 12 (the Size 2 triangle plus every hex touching it).
# Every footprint is placed by position only; a mini's rotation never
# changes it (Prompts 12 and 13).

# Hex-centered sizes: axial (q, r) offsets around the hex nearest the base.
# Size 1/2 and 1 = that hex; Size 3 = that hex plus its 6 neighbors.
FOOTPRINTS = {
    0.5: ((0, 0),),
    1: ((0, 0),),
    3: ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1), (1, -1), (-1, 1)),
}
# Corner-centered sizes: the 3 hex centers nearest the base (the triangle
# around the hex corner it sits on), grown by this many rings of touching
# hexes. Size 2 = the triangle; Size 4 = the triangle + every hex touching
# it. Which corner the base sits on decides point-up vs point-down.
CORNER_RINGS = {2: 0, 4: 1}
SIZES = tuple(sorted(set(FOOTPRINTS) | set(CORNER_RINGS)))
DEFAULT_SIZE = 1

# Warn when a mini is this far from a clean placement (its hex center for
# hex-centered sizes, its corner for corner-centered sizes).
PLACEMENT_TOLERANCE_HEX = 0.3   # fraction of one hex step

# --- Sides ---
SIDE_UNKNOWN = "unknown"
SIDE_ORDER = ("player", "npc")  # report order; other sides follow by name
