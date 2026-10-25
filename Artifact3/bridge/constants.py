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
