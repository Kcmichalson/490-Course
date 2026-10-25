"""Tunable values and defaults. Every tunable lives here and nowhere else."""

# --- Network: local only. server.py refuses any other host. ---
HOST = "127.0.0.1"
PORT = 8765
MAX_BODY_BYTES = 1_000_000

# --- Versions ---
SCHEMA_VERSION = 1    # processed snapshot (snapshots/latest.json)
PAYLOAD_VERSION = 1   # raw payload the Lua exporter POSTs to /tts

# --- Storage (relative to Artifact3/) ---
SNAPSHOT_DIR = "snapshots"
LATEST_FILE = "latest.json"
HISTORY_FILE = "history.jsonl"

# --- Tracking marker: first description line "AIT: <kind>" ---
MARKER_KEY = "ait"
KINDS = ("unit", "terrain", "hazard", "objective")

# --- TTS Grid settings ---
# Grid.type → hex orientation. UNVERIFIED: which TTS hex type is pointy-top
# is a guess; check in TTS during M2. Type 1 (rectangles) is rejected.
GRID_TYPE_ORIENTATION = {2: "pointy", 3: "flat"}

# --- Footprints ---
# LANCER Size → occupied hexes, per the user's rule (LOG.md, Session 1,
# Prompts 2 and 5): Size 1/2 and 1 = 1 hex, 2 = 3, 3 = 7, 4 = 12 in rows of
# 3, 4, 3, 2. Axial (q, r) offsets at rotation 0. Shapes confirmed in
# Prompt 7: Size 2 = triangle, Size 3 = flower, Size 4 = rows 3, 4, 3, 2.
FOOTPRINTS = {
    0.5: ((0, 0),),
    1: ((0, 0),),
    2: ((0, 0), (1, 0), (0, 1)),
    3: ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1), (1, -1), (-1, 1)),
    4: ((-1, 0), (0, 0), (1, 0),
        (-2, 1), (-1, 1), (0, 1), (1, 1),
        (-2, 2), (-1, 2), (0, 2),
        (-2, 3), (-1, 3)),
}
DEFAULT_SIZE = 1

# Footprints rotate with the mini in 60° steps (user's rule, Prompt 5).
# UNVERIFIED (M3 calibration): which TTS Y rotation is the shape's 0, and
# whether +Y rotation turns it the same way as one axial step.
ROTATION_STEP_DEG = 60.0
ROTATION_OFFSET_DEG = 0.0
ROTATION_SIGN = 1

# Warn when a mini is this far from a clean placement.
ROTATION_TOLERANCE_DEG = 15.0
PLACEMENT_TOLERANCE_HEX = 0.3   # fraction of one hex step

# --- Sides ---
SIDE_UNKNOWN = "unknown"
SIDE_ORDER = ("player", "npc")  # report order; other sides follow by name
