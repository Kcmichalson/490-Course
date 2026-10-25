import copy
import json
import unittest
from pathlib import Path

from bridge import snapshot as S

FIXTURES = Path(__file__).resolve().parent / "fixtures"
RECEIVED_AT = "2026-10-24T22:15:03Z"


def load(name):
    with open(FIXTURES / name, encoding="utf-8") as f:
        return json.load(f)


def unit(snap, name):
    return next(u for u in snap["units"] if u["name"] == name)


def minimal(*objects):
    return {"payload_version": 2,
            "grid": {"type": 2, "sizeX": 2.0, "sizeY": 2.0},
            "objects": list(objects)}


def obj(description, guid="g1", name="Thing", x=0.0, z=0.0, rot=0.0,
        held=None, resting=True):
    return {"guid": guid, "name": name, "description": description,
            "position": {"x": x, "y": 1.0, "z": z},
            "rotation": {"x": 0.0, "y": rot, "z": 0.0},
            "held_by_color": held, "resting": resting}


class MarkerTests(unittest.TestCase):
    def test_kinds_any_case_and_spacing(self):
        for text, kind in [("AIT: Unit", "unit"), ("ait: terrain", "terrain"),
                           ("AIT:HAZARD", "hazard"), ("  ait :  Objective  ", "objective"),
                           ("Ait: Unit\nSize: 2", "unit"), ("AIT: Unit\r\nSize: 2", "unit"),
                           ("\nAIT: Unit", "unit"), ("\n  \n\t\r\nAIT: Terrain\nCover: Hard", "terrain")]:
            with self.subTest(text=text):
                self.assertEqual(S.parse_marker(text), (kind, None))

    def test_not_marked(self):
        for text in ["", "\n\n", "Size: 2", "HP: 3\nAIT: Unit", "Unit", "AITX: Unit"]:
            with self.subTest(text=text):
                self.assertEqual(S.parse_marker(text), (None, None))

    def test_bad_marker_warns(self):
        kind, warning = S.parse_marker("AIT: Foo")
        self.assertIsNone(kind)
        self.assertIn("Foo", warning)
        kind, warning = S.parse_marker("AIT:")
        self.assertIsNone(kind)
        self.assertIn("no kind", warning)


class DescriptionTests(unittest.TestCase):
    def test_pairs_commas_and_lines(self):
        pairs, notes, warnings = S.parse_description(
            "AIT: Unit\nSide: Player\nHP: 8/12, Heat: 3/8, Conditions: Impaired, Slowed\n"
            "Line of flavor text\n\nMax  Speed: 4")
        self.assertEqual(pairs, {"side": "Player", "hp": "8/12", "heat": "3/8",
                                 "conditions": "Impaired, Slowed", "max speed": "4"})
        self.assertEqual(notes, ["Line of flavor text"])
        self.assertEqual(warnings, [])

    def test_keys_case_insensitive_and_duplicates(self):
        pairs, _, warnings = S.parse_description("AIT: Unit\nHP: 3/5\nhp: 4/5")
        self.assertEqual(pairs, {"hp": "4/5"})
        self.assertEqual(len(warnings), 1)

    def test_marker_only(self):
        self.assertEqual(S.parse_description("AIT: Unit"), ({}, [], []))

    def test_blank_lines_before_marker(self):
        pairs, notes, _ = S.parse_description("\n\n  \nAIT: Unit\nSize: 2\nHP: 3/5")
        self.assertEqual(pairs, {"size": "2", "hp": "3/5"})
        self.assertEqual(notes, [])

    def test_stat_values(self):
        self.assertEqual(S.parse_stat("8/12"), {"current": 8, "max": 12})
        self.assertEqual(S.parse_stat(" 8 / 12 "), {"current": 8, "max": 12})
        self.assertEqual(S.parse_stat("4"), {"current": 4, "max": None})
        self.assertIsNone(S.parse_stat("lots"))

    def test_sizes(self):
        for text, size in [("1/2", 0.5), ("½", 0.5), ("0.5", 0.5), ("1", 1),
                           ("2", 2), ("3", 3), ("4", 4)]:
            self.assertEqual(S.parse_size(text), size)
        for text in ["5", "0", "big", "2.5"]:
            self.assertIsNone(S.parse_size(text))

    def test_conditions(self):
        self.assertEqual(S.parse_conditions("none"), [])
        self.assertEqual(S.parse_conditions("-"), [])
        self.assertEqual(S.parse_conditions("Shredded, Slowed"), ["Shredded", "Slowed"])


class ValidationTests(unittest.TestCase):
    def assertRejected(self, payload, message):
        with self.assertRaises(S.PayloadError) as ctx:
            S.build_snapshot(payload, RECEIVED_AT, 0)
        self.assertIn(message, str(ctx.exception))

    def test_top_level_errors(self):
        good = minimal()
        self.assertRejected([], "must be a JSON object")
        self.assertRejected({**good, "payload_version": 1}, "payload_version")
        self.assertRejected({**good, "payload_version": True}, "payload_version")
        self.assertRejected({k: v for k, v in good.items() if k != "grid"}, "missing 'grid'")
        self.assertRejected({**good, "grid": "hex"}, "'grid' must be an object")
        self.assertRejected({**good, "grid": {**good["grid"], "type": 1}}, "grid must be hex")
        self.assertRejected({**good, "grid": {**good["grid"], "type": "2"}}, "grid.type")
        self.assertRejected({**good, "grid": {**good["grid"], "sizeX": 0}}, "grid.sizeX")
        self.assertRejected({**good, "grid": {**good["grid"], "sizeY": "2"}}, "grid.sizeY")
        self.assertRejected({**good, "grid": {**good["grid"], "offsetX": None}}, "grid.offsetX")
        self.assertRejected({k: v for k, v in good.items() if k != "objects"}, "'objects'")

    def test_bad_objects_are_skipped_with_warning(self):
        no_pos = obj("AIT: Unit\nSide: player\nSize: 1", guid="g2", name="NoPos")
        del no_pos["position"]
        nan_pos = obj("AIT: Unit\nSide: player\nSize: 1", guid="g3", name="Nan")
        nan_pos["position"]["x"] = float("nan")
        snap = S.build_snapshot(minimal(
            "not an object", no_pos, nan_pos,
            {**obj("AIT: Unit"), "guid": ""},
            obj("AIT: Unit\nSide: player\nSize: 1", guid="ok", name="Good")),
            RECEIVED_AT, 0)
        self.assertEqual([u["name"] for u in snap["units"]], ["Good"])
        self.assertEqual(len(snap["warnings"]), 4)

    def test_unmarked_objects_ignored_silently_even_if_broken(self):
        snap = S.build_snapshot(minimal({"name": "Lamp", "description": "decor"},
                                        {"description": 5}), RECEIVED_AT, 0)
        self.assertEqual(snap["units"], [])
        self.assertEqual(len(snap["warnings"]), 1)  # non-text description only

    def test_unit_warnings(self):
        snap = S.build_snapshot(minimal(
            obj("AIT: Unit", guid="a", name="Bare"),
            obj("AIT: Unit\nSide: npc\nSize: 7", guid="b", name="Huge"),
            obj("AIT: Unit\nSide: npc\nSize: 4", guid="c", name="Offcorner4", x=20.0),
            obj("AIT: Unit\nSide: npc\nSize: 2", guid="f", name="Offcorner", x=-10.0),
            obj("AIT: Unit\nSide: npc\nSize: 1\nHP: lots", guid="d", name="Odd", x=10.0),
            obj("AIT: Foo", guid="e", name="Typo"),
            obj("AIT: Unit\nSide: npc", guid="a", name="Dupe")),
            RECEIVED_AT, 0)
        text = "\n".join(snap["warnings"])
        self.assertIn("'Bare' has no Size; using 1", text)
        self.assertIn("'Bare' has no Side; using unknown", text)
        self.assertIn("'Huge' has unsupported Size '7'; skipped", text)
        self.assertNotIn("rotation", text)
        self.assertIn("'Offcorner' may be between hexes", text)
        self.assertIn("'Offcorner4' may be between hexes", text)
        self.assertIn("'Odd' hp 'lots' is not a number", text)
        self.assertIn("unknown AIT kind 'Foo'", text)
        self.assertIn("duplicate guid 'a'", text)
        self.assertEqual(sorted(u["name"] for u in snap["units"]),
                         ["Bare", "Odd", "Offcorner", "Offcorner4"])
        self.assertEqual(unit(snap, "Bare")["side"], "unknown")
        self.assertEqual(unit(snap, "Odd")["extra"], {"hp": "lots"})


class FixtureTests(unittest.TestCase):
    def test_pointy_fixture_hand_checked(self):
        snap = S.build_snapshot(load("payload_pointy.json"), RECEIVED_AT, 1)
        self.assertEqual([u["name"] for u in snap["units"]],
                         ["Ironclad", "Vanguard", "Assault-1", "Demolisher"])
        hexes = {u["name"]: sorted(map(tuple, u["hexes"])) for u in snap["units"]}
        self.assertEqual(hexes["Vanguard"], [(0, 0)])
        self.assertEqual(hexes["Ironclad"], sorted([(2, 0), (3, 0), (2, 1)]))
        self.assertEqual(hexes["Assault-1"], [(5, -3)])
        self.assertEqual(hexes["Demolisher"], sorted([(6, 2), (7, 2), (5, 2), (6, 3),
                                                      (6, 1), (7, 1), (5, 3)]))
        names = {u["guid"]: u["name"] for u in snap["units"]}
        dist = {(names[d["a"]], names[d["b"]]): d["hexes"] for d in snap["distances"]}
        self.assertEqual(dist, {("Ironclad", "Assault-1"): 3, ("Ironclad", "Demolisher"): 4,
                                ("Vanguard", "Assault-1"): 5, ("Vanguard", "Demolisher"): 7})
        areas = {a["name"]: sorted(map(tuple, a["hexes"]))
                 for a in snap["terrain"] + snap["hazards"] + snap["objectives"]}
        self.assertEqual(areas["Rock wall"], sorted([(1, -2), (2, -2), (3, -2)]))
        self.assertEqual(areas["Crates"], [(-1, 1)])
        self.assertEqual(areas["Reactor leak"], sorted([(0, 2), (1, 2)]))
        self.assertEqual(areas["Uplink"], sorted([(4, 0), (5, 0), (3, 0), (4, 1),
                                                  (4, -1), (5, -1), (3, 1)]))
        self.assertEqual(snap["objectives"][0]["units_in_zone"],
                         [{"guid": "aa0002", "hexes_inside": 1, "hexes_total": 3}])
        ironclad = unit(snap, "Ironclad")
        self.assertEqual(ironclad["stats"]["hp"], {"current": 8, "max": 12})
        self.assertEqual(ironclad["stats"]["conditions"], ["Impaired"])
        self.assertEqual(unit(snap, "Demolisher")["stats"]["conditions"], ["Shredded", "Slowed"])
        self.assertEqual(unit(snap, "Assault-1")["extra"], {"tier": "1"})
        self.assertNotIn("Table lamp", json.dumps(snap))
        self.assertEqual(snap["warnings"], [])

    def test_flat_fixture_hand_checked(self):
        snap = S.build_snapshot(load("payload_flat.json"), RECEIVED_AT, 1)
        self.assertEqual(snap["grid"]["source"], "tts_grid")
        self.assertEqual(snap["grid"]["tts_grid"]["orientation"], "flat")
        self.assertEqual(unit(snap, "Scout")["hexes"], [[-2, 1]])
        hunter = unit(snap, "Hunter")
        self.assertEqual(sorted(map(tuple, hunter["hexes"])), sorted([(3, -1), (3, 0), (2, 0)]))
        self.assertNotIn("rotation_steps", hunter)    # rotation is raw data only
        self.assertEqual(hunter["rotation_y"], 60.0)
        self.assertEqual(snap["distances"][0]["hexes"], 4)
        self.assertEqual(snap["terrain"][0]["hexes"], [[0, 0]])
        self.assertEqual(snap["objectives"][0]["hexes"], [[2, 0]])
        self.assertEqual(snap["objectives"][0]["units_in_zone"],
                         [{"guid": "bb0101", "hexes_inside": 1, "hexes_total": 3}])

    def test_calibrated_fixture_hand_checked(self):
        snap = S.build_snapshot(load("payload_calibrated.json"), RECEIVED_AT, 1)
        self.assertEqual([u["name"] for u in snap["units"]],
                         ["Ironclad", "Scout", "Goliath", "Hawk"])
        hexes = {u["name"]: set(map(tuple, u["hexes"])) for u in snap["units"]}
        self.assertEqual(hexes["Ironclad"], {(4, -1), (5, -1), (4, 0)})
        self.assertEqual(hexes["Scout"], {(2, 1)})
        tri = {(8, 1), (9, 1), (8, 2)}
        self.assertEqual(hexes["Goliath"], tri | {(9, 0), (8, 0), (7, 1), (7, 2), (10, 1),
                                                  (10, 0), (9, 2), (7, 3), (8, 3)})
        self.assertEqual(hexes["Hawk"], {(-2, 3)})
        self.assertTrue(unit(snap, "Hawk")["flying"])   # blank lines before AIT too
        self.assertFalse(unit(snap, "Scout")["flying"])
        names = {u["guid"]: u["name"] for u in snap["units"]}
        dist = {(names[d["a"]], names[d["b"]]): d["hexes"] for d in snap["distances"]}
        self.assertEqual(dist, {("Ironclad", "Goliath"): 4, ("Ironclad", "Hawk"): 6,
                                ("Scout", "Goliath"): 5, ("Scout", "Hawk"): 4})
        self.assertEqual(snap["terrain"][0]["hexes"], [[3, 3]])
        self.assertEqual(snap["objectives"][0]["hexes"], [[4, 0]])
        self.assertEqual(snap["objectives"][0]["units_in_zone"],
                         [{"guid": "aa0201", "hexes_inside": 1, "hexes_total": 3}])
        self.assertNotIn("Flight stand", json.dumps(snap))   # unmarked pedestal
        self.assertNotIn("Cal origin", json.dumps(snap["units"]))
        self.assertEqual(snap["in_motion"], [])
        self.assertEqual(snap["warnings"], [])

    def test_matches_expected_files(self):
        for name in ("pointy", "flat", "calibrated"):
            with self.subTest(fixture=name):
                snap = S.build_snapshot(load("payload_%s.json" % name), RECEIVED_AT, 1)
                self.assertEqual(snap, load("expected_snapshot_%s.json" % name))


class MotionTests(unittest.TestCase):
    T0 = "2026-10-24T22:15:00Z"

    def at(self, when, previous=None, held="Red", resting=True, kind="Unit"):
        desc = "AIT: %s\nSide: player\nSize: 1" % kind
        return S.build_snapshot(minimal(obj(desc, held=held, resting=resting)),
                                when, 1, previous)

    def test_held_unit_is_in_motion(self):
        snap = self.at(self.T0)
        self.assertEqual(snap["in_motion"], ["g1"])
        self.assertEqual(snap["units"][0]["held_by"], "Red")
        self.assertEqual(snap["units"][0]["in_motion_since"], self.T0)

    def test_not_resting_unit_is_in_motion(self):
        snap = self.at(self.T0, held=None, resting=False)
        self.assertEqual(snap["in_motion"], ["g1"])
        self.assertIsNone(snap["units"][0]["held_by"])

    def test_still_unit_is_not_in_motion(self):
        for held in (None, ""):
            snap = self.at(self.T0, held=held)
            self.assertEqual(snap["in_motion"], [])
            self.assertIsNone(snap["units"][0]["in_motion_since"])

    def test_only_units_count(self):
        snap = self.at(self.T0, kind="Terrain")
        self.assertEqual(snap["in_motion"], [])

    def test_stale_motion_stops_blocking_after_30_seconds(self):
        first = self.at(self.T0)
        later = self.at("2026-10-24T22:15:20Z", first)
        self.assertEqual(later["in_motion"], ["g1"])
        self.assertEqual(later["units"][0]["in_motion_since"], self.T0)
        self.assertEqual(later["warnings"], [])
        edge = self.at("2026-10-24T22:15:30Z", later)   # exactly 30 s: still counts
        self.assertEqual(edge["in_motion"], ["g1"])
        stale = self.at("2026-10-24T22:15:31Z", edge)
        self.assertEqual(stale["in_motion"], [])
        self.assertEqual(stale["warnings"],
                         ["'Thing' has been in motion for over 30 s (held by Red); "
                          "it no longer holds back history"])
        # Released: the clock resets.
        released = self.at("2026-10-24T22:15:40Z", stale, held=None)
        self.assertIsNone(released["units"][0]["in_motion_since"])
        again = self.at("2026-10-24T22:15:45Z", released)
        self.assertEqual(again["units"][0]["in_motion_since"], "2026-10-24T22:15:45Z")

    def test_picking_up_and_putting_back_is_not_a_board_change(self):
        still = self.at(self.T0, held=None)
        held = self.at(self.T0, held="Red")
        self.assertTrue(S.same_board(still, held))


class FlyingTests(unittest.TestCase):
    def flying(self, conditions):
        desc = "AIT: Unit\nSide: npc\nSize: 1" + ("\nConditions: " + conditions
                                                  if conditions is not None else "")
        return S.build_snapshot(minimal(obj(desc)), RECEIVED_AT, 1)["units"][0]["flying"]

    def test_flying_condition(self):
        self.assertTrue(self.flying("Flying"))
        self.assertTrue(self.flying("impaired, FLYING"))
        self.assertFalse(self.flying("Impaired"))
        self.assertFalse(self.flying("none"))
        self.assertFalse(self.flying(None))

    def test_taking_off_is_a_board_change(self):
        grounded = S.build_snapshot(minimal(obj("AIT: Unit\nSide: npc\nSize: 1")), RECEIVED_AT, 1)
        flying = S.build_snapshot(minimal(obj("AIT: Unit\nSide: npc\nSize: 1\nConditions: Flying")),
                                  RECEIVED_AT, 1)
        self.assertFalse(S.same_board(grounded, flying))


class RotationTests(unittest.TestCase):
    """Footprints depend on position only; rotation is raw data (Prompt 13)."""

    # Pointy grid, size 2: two neighboring corners on the edge (3,0)-(2,1).
    TWO_ON_TOP_CORNER = (5.0, 0.57735)    # corner of (2,0),(3,0),(2,1)
    ONE_ON_TOP_CORNER = (6.0, 1.154701)   # corner of (3,0),(2,1),(3,1)

    def snap_at(self, size, x, z, rot):
        desc = "AIT: Unit\nSide: npc\nSize: %s" % size
        return S.build_snapshot(minimal(obj(desc, x=x, z=z, rot=rot)), RECEIVED_AT, 1)

    def test_turning_in_place_never_changes_hexes(self):
        places = {"1/2": (7.12, -5.15), "1": (7.12, -5.15),
                  "2": self.TWO_ON_TOP_CORNER, "3": (14.0, 3.464102),
                  "4": self.TWO_ON_TOP_CORNER}
        for size, (x, z) in places.items():
            first = self.snap_at(size, x, z, 0.0)
            for rot in range(-180, 361, 7):
                with self.subTest(size=size, rot=rot):
                    snap = self.snap_at(size, x, z, float(rot))
                    self.assertEqual(snap["units"][0]["hexes"], first["units"][0]["hexes"])
                    self.assertEqual(snap["units"][0]["rotation_y"], float(rot))
                    self.assertNotIn("rotation_steps", snap["units"][0])
                    self.assertEqual(snap["warnings"], [])
                    self.assertTrue(S.same_board(first, snap))

    def test_flip_to_the_other_corner_is_a_move(self):
        # House rule: flipping a Size 2 or 4 (point-up ↔ point-down) costs 1
        # movement. It's a move to the neighboring corner, so it registers.
        for size, count in (("2", 3), ("4", 12)):
            with self.subTest(size=size):
                a = self.snap_at(size, *self.TWO_ON_TOP_CORNER, 0.0)
                b = self.snap_at(size, *self.ONE_ON_TOP_CORNER, 0.0)
                self.assertEqual(len(b["units"][0]["hexes"]), count)
                self.assertNotEqual(a["units"][0]["hexes"], b["units"][0]["hexes"])
                self.assertFalse(S.same_board(a, b))
                self.assertEqual(b["warnings"], [])

    def test_size_4_is_the_triangle_plus_touching_hexes(self):
        snap = self.snap_at("4", *self.TWO_ON_TOP_CORNER, 0.0)
        tri = {(2, 0), (3, 0), (2, 1)}
        expected = tri | {(q + dq, r + dr) for q, r in tri
                          for dq, dr in ((1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1))}
        self.assertEqual(set(map(tuple, snap["units"][0]["hexes"])), expected)
        self.assertEqual(len(expected), 12)


class SameBoardTests(unittest.TestCase):
    def test_ignores_time_seq_and_jitter(self):
        payload = load("payload_pointy.json")
        a = S.build_snapshot(payload, RECEIVED_AT, 1)
        jittered = copy.deepcopy(payload)
        jittered["objects"][0]["position"]["x"] += 0.02
        jittered["objects"][0]["rotation"]["y"] += 3.0
        b = S.build_snapshot(jittered, "2026-10-24T22:15:08Z", 2)
        self.assertTrue(S.same_board(a, b))

    def test_detects_moves_and_stat_changes(self):
        payload = load("payload_pointy.json")
        a = S.build_snapshot(payload, RECEIVED_AT, 1)
        moved = copy.deepcopy(payload)
        moved["objects"][0]["position"]["x"] += 2.0
        self.assertFalse(S.same_board(a, S.build_snapshot(moved, RECEIVED_AT, 1)))
        hurt = copy.deepcopy(payload)
        hurt["objects"][0]["description"] = hurt["objects"][0]["description"].replace(
            "HP: 10/10", "HP: 9/10")
        self.assertFalse(S.same_board(a, S.build_snapshot(hurt, RECEIVED_AT, 1)))
        self.assertFalse(S.same_board(None, a))


if __name__ == "__main__":
    unittest.main()
