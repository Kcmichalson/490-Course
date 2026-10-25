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
    return {"payload_version": 1,
            "grid": {"type": 2, "sizeX": 2.0, "sizeY": 2.0},
            "objects": list(objects)}


def obj(description, guid="g1", name="Thing", x=0.0, z=0.0, rot=0.0):
    return {"guid": guid, "name": name, "description": description,
            "position": {"x": x, "y": 1.0, "z": z},
            "rotation": {"x": 0.0, "y": rot, "z": 0.0}}


class MarkerTests(unittest.TestCase):
    def test_kinds_any_case_and_spacing(self):
        for text, kind in [("AIT: Unit", "unit"), ("ait: terrain", "terrain"),
                           ("AIT:HAZARD", "hazard"), ("  ait :  Objective  ", "objective"),
                           ("Ait: Unit\nSize: 2", "unit"), ("AIT: Unit\r\nSize: 2", "unit")]:
            with self.subTest(text=text):
                self.assertEqual(S.parse_marker(text), (kind, None))

    def test_not_marked(self):
        for text in ["", "Size: 2", "\nAIT: Unit", "HP: 3\nAIT: Unit", "Unit", "AITX: Unit"]:
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
        self.assertRejected({**good, "payload_version": 2}, "payload_version")
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
            obj("AIT: Unit\nSide: npc\nSize: 2", guid="c", name="Tilted", rot=30.0),
            obj("AIT: Unit\nSide: npc\nSize: 1\nHP: lots", guid="d", name="Odd", x=10.0),
            obj("AIT: Foo", guid="e", name="Typo"),
            obj("AIT: Unit\nSide: npc", guid="a", name="Dupe")),
            RECEIVED_AT, 0)
        text = "\n".join(snap["warnings"])
        self.assertIn("'Bare' has no Size; using 1", text)
        self.assertIn("'Bare' has no Side; using unknown", text)
        self.assertIn("'Huge' has unsupported Size '7'; skipped", text)
        self.assertIn("'Tilted' rotation 30° is between 60° steps", text)
        self.assertIn("'Tilted' may be between hexes", text)
        self.assertIn("'Odd' hp 'lots' is not a number", text)
        self.assertIn("unknown AIT kind 'Foo'", text)
        self.assertIn("duplicate guid 'a'", text)
        self.assertEqual(sorted(u["name"] for u in snap["units"]), ["Bare", "Odd", "Tilted"])
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
        self.assertEqual(snap["grid"]["orientation"], "flat")
        self.assertEqual(unit(snap, "Scout")["hexes"], [[-2, 1]])
        hunter = unit(snap, "Hunter")
        self.assertEqual(sorted(map(tuple, hunter["hexes"])), sorted([(3, -1), (3, 0), (2, 0)]))
        self.assertEqual(hunter["rotation_steps"], 1)
        self.assertEqual(snap["distances"][0]["hexes"], 4)
        self.assertEqual(snap["terrain"][0]["hexes"], [[0, 0]])
        self.assertEqual(snap["objectives"][0]["hexes"], [[2, 0]])
        self.assertEqual(snap["objectives"][0]["units_in_zone"],
                         [{"guid": "bb0101", "hexes_inside": 1, "hexes_total": 3}])

    def test_matches_expected_files(self):
        for orient in ("pointy", "flat"):
            with self.subTest(orient=orient):
                snap = S.build_snapshot(load("payload_%s.json" % orient), RECEIVED_AT, 1)
                self.assertEqual(snap, load("expected_snapshot_%s.json" % orient))


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
