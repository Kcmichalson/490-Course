import copy
import itertools
import json
import math
import unittest
from pathlib import Path

from bridge import constants as C
from bridge import hexgrid as H
from bridge import snapshot as S

FIXTURES = Path(__file__).resolve().parent / "fixtures"
RECEIVED_AT = "2026-10-24T22:15:03Z"
TOL = (C.CAL_SPACING_TOLERANCE, C.CAL_ANGLE_TOLERANCE_DEG)
HEXES = list(itertools.product(range(-6, 7), repeat=2))


def load(name):
    with open(FIXTURES / name, encoding="utf-8") as f:
        return json.load(f)


def along(origin, step, angle_deg, n):
    a = math.radians(angle_deg)
    return (origin[0] + n * step * math.cos(a), origin[1] + n * step * math.sin(a))


def marker(payload, point):
    return next(o for o in payload["objects"]
                if "Point: %s" % point in o["description"])


def shift(obj, dx, dz):
    for key in ("x", "z"):
        obj["position"][key] += dx if key == "x" else dz
        obj["bounds"]["center"][key] += dx if key == "x" else dz


def move_b_off_its_row(payload):
    """Swing marker B 10° around Origin: same distance, wrong row."""
    b = marker(payload, "B")
    x, z = along((10.0, -4.0), 2.5, 87.0, 5)   # fixture rows are 17° and 77°
    shift(b, x - b["position"]["x"], z - b["position"]["z"])


def unit_hexes(snap):
    return {u["name"]: u["hexes"] for u in snap["units"]}


class LatticeFromMarkersTests(unittest.TestCase):
    def test_unrotated_markers_match_the_tts_grid(self):
        tts = H.tts_lattice("pointy", 2.0, 2.0, 1.5, -3.0)
        o, a, b = (H.axial_to_world(tts, h) for h in ((0, 0), (4, 0), (0, 4)))
        lat, info = H.lattice_from_markers(o, a, 4, b, 4, *TOL)
        for field, want in zip(lat, tts):
            self.assertAlmostEqual(field, want)
        self.assertAlmostEqual(info["angle_between_deg"], 60.0)
        for h in HEXES:
            self.assertEqual(H.world_to_axial(lat, *H.axial_to_world(tts, h)), h)

    def test_rotated_grid(self):
        o = (10.0, -4.0)
        lat, _ = H.lattice_from_markers(o, along(o, 2.5, 17.0, 6), 6,
                                        along(o, 2.5, 77.0, 5), 5, *TOL)
        self.assertAlmostEqual(H.hex_step(lat), 2.5)
        self.assertAlmostEqual(H.row_angle_deg(lat), 17.0)
        for h in HEXES:
            self.assertEqual(H.world_to_axial(lat, *H.axial_to_world(lat, h)), h)
        # Hand check: hex (1, 0) is one step along 17°, (0, 1) along 77°.
        x, z = along(o, 2.5, 17.0, 1)
        self.assertEqual(H.world_to_axial(lat, x, z), (1, 0))
        x, z = along(o, 2.5, 77.0, 1)
        self.assertEqual(H.world_to_axial(lat, x, z), (0, 1))

    def test_120_degree_rows_give_the_same_lattice(self):
        o = (10.0, -4.0)
        a = along(o, 2.5, 17.0, 6)
        lat60, _ = H.lattice_from_markers(o, a, 6, along(o, 2.5, 77.0, 5), 5, *TOL)
        lat120, info = H.lattice_from_markers(o, a, 6, along(o, 2.5, 137.0, 4), 4, *TOL)
        self.assertAlmostEqual(info["angle_between_deg"], 120.0)
        for field, want in zip(lat120, lat60):
            self.assertAlmostEqual(field, want)

    def test_mirrored_rows_are_valid_and_keep_distances(self):
        o = (0.0, 0.0)
        lat, _ = H.lattice_from_markers(o, along(o, 2.0, 0.0, 5), 5,
                                        along(o, 2.0, -60.0, 5), 5, *TOL)
        ref = H.tts_lattice("pointy", 2.0, 2.0)
        for p, q in itertools.combinations([(0, 0), (3, -1), (-2, 4), (5, 2)], 2):
            wp, wq = H.axial_to_world(ref, p), H.axial_to_world(ref, q)
            self.assertEqual(H.distance(H.world_to_axial(lat, *wp), H.world_to_axial(lat, *wq)),
                             H.distance(p, q))

    def test_errors(self):
        o = (10.0, -4.0)
        a = along(o, 2.5, 17.0, 6)
        cases = [
            (along(o, 2.5, 77.0, 5), 6, "inconsistent spacing"),   # wrong Hexes
            (along(o, 2.5, 107.0, 5), 5, "aren't on hex rows"),     # 90° apart
            (along(o, 2.5, 82.0, 5), 5, "aren't on hex rows"),      # 65° apart
            (o, 5, "on Origin"),
        ]
        for b, n, message in cases:
            with self.subTest(message=message, n=n):
                with self.assertRaises(H.CalibrationError) as ctx:
                    H.lattice_from_markers(o, a, 6, b, n, *TOL)
                self.assertIn(message, str(ctx.exception))

    def test_tolerances_accept_small_errors(self):
        o = (10.0, -4.0)
        # 2% spacing difference and a 2° angle error are within tolerance.
        lat, info = H.lattice_from_markers(o, along(o, 2.5, 17.0, 6), 6,
                                           along(o, 2.55, 79.0, 5), 5, *TOL)
        self.assertLess(info["spacing_mismatch"], C.CAL_SPACING_TOLERANCE)


class SnapshotCalibrationTests(unittest.TestCase):
    def build(self, payload, saved=None):
        return S.build_snapshot(payload, RECEIVED_AT, 1, None, saved)

    def test_fixture_uses_calibration_and_ignores_tts_grid(self):
        snap = self.build(load("payload_calibrated.json"))
        g = snap["grid"]
        self.assertEqual(g["source"], "calibration")
        self.assertAlmostEqual(g["hex_step"], 2.5, places=4)
        self.assertAlmostEqual(g["row_angle_deg"], 17.0, places=3)
        self.assertIsNone(g["calibration_error"])
        self.assertIsNone(g["tts_grid"])   # type 1 grid would be rejected
        self.assertEqual(g["calibration"]["saved_at"], RECEIVED_AT)

    def test_no_markers_uses_tts_grid(self):
        payload = load("payload_calibrated.json")
        payload["objects"] = [o for o in payload["objects"]
                              if "Calibration" not in o["description"]]
        with self.assertRaises(S.PayloadError) as ctx:   # type 1 isn't hex
            self.build(payload)
        self.assertIn("grid must be hex", str(ctx.exception))
        payload["grid"] = {"type": 2, "sizeX": 2.0, "sizeY": 2.0}
        self.assertEqual(self.build(payload)["grid"]["source"], "tts_grid")

    def test_invalid_markers_without_saved_calibration_are_unavailable(self):
        payload = load("payload_calibrated.json")
        move_b_off_its_row(payload)
        snap = self.build(payload)
        g = snap["grid"]
        self.assertEqual(g["source"], "unavailable")
        self.assertIsNone(g["lattice"])
        self.assertTrue(g["calibration_error"])
        self.assertTrue(all(u["hexes"] == [] for u in snap["units"]))
        self.assertTrue(all(a["hexes"] == [] for a in snap["terrain"] + snap["objectives"]))
        self.assertEqual(snap["distances"], [])
        self.assertEqual(snap["objectives"][0]["units_in_zone"], [])

    def test_invalid_markers_keep_the_saved_calibration(self):
        good = self.build(load("payload_calibrated.json"))
        saved = good["grid"]["calibration"]
        payload = load("payload_calibrated.json")
        move_b_off_its_row(payload)
        snap = self.build(payload, saved)
        self.assertEqual(snap["grid"]["source"], "saved_calibration")
        self.assertEqual(snap["grid"]["calibration"], saved)
        self.assertIn("aren't on hex rows", snap["grid"]["calibration_error"])
        self.assertEqual(unit_hexes(snap), unit_hexes(good))

    def test_marker_problems_are_named(self):
        cases = []
        p = load("payload_calibrated.json")
        p["objects"].remove(marker(p, "A"))
        cases.append((p, "missing calibration marker: Point: A"))
        p = load("payload_calibrated.json")
        marker(p, "B")["description"] = "AIT: Calibration\nPoint: A\nHexes: 5"
        cases.append((p, "two markers have Point: A"))
        p = load("payload_calibrated.json")
        marker(p, "A")["description"] = "AIT: Calibration\nPoint: A\nHexes: six"
        cases.append((p, "needs Hexes: a positive whole number"))
        p = load("payload_calibrated.json")
        marker(p, "Origin")["description"] = "AIT: Calibration\nPoint: Middle"
        cases.append((p, "expected Origin, A, or B"))
        p = load("payload_calibrated.json")
        extra = copy.deepcopy(marker(p, "Origin"))
        extra["guid"] = "ca0009"
        p["objects"].append(extra)
        cases.append((p, "4 calibration markers; expected 3"))
        for payload, message in cases:
            with self.subTest(message=message):
                g = self.build(payload)["grid"]
                self.assertEqual(g["source"], "unavailable")
                self.assertIn(message, g["calibration_error"])

    def test_bumped_marker_within_tolerance_changes_no_hex(self):
        good = self.build(load("payload_calibrated.json"))
        saved = good["grid"]["calibration"]
        for point, (dx, dz) in (("Origin", (0.2, -0.15)), ("A", (-0.25, 0.1)),
                                ("B", (0.1, 0.3))):
            with self.subTest(point=point):
                payload = load("payload_calibrated.json")
                shift(marker(payload, point), dx, dz)
                snap = S.build_snapshot(payload, "2026-10-24T22:20:00Z", 1, good, saved)
                self.assertEqual(snap["grid"]["source"], "calibration")
                self.assertEqual(snap["grid"]["calibration"], saved)
                self.assertEqual(unit_hexes(snap), unit_hexes(good))
                self.assertTrue(S.same_board(good, snap))

    def test_marker_moved_beyond_tolerance_recalibrates(self):
        good = self.build(load("payload_calibrated.json"))
        saved = good["grid"]["calibration"]
        payload = load("payload_calibrated.json")
        for point in ("Origin", "A", "B"):   # the whole set moved 1 hex along q
            shift(marker(payload, point), 2.3907619, 0.7309293)
        snap = S.build_snapshot(payload, "2026-10-24T22:20:00Z", 1, good, saved)
        self.assertEqual(snap["grid"]["source"], "calibration")
        self.assertNotEqual(snap["grid"]["calibration"], saved)
        self.assertEqual(snap["grid"]["calibration"]["saved_at"], "2026-10-24T22:20:00Z")
        self.assertEqual(unit_hexes(snap)["Scout"], [[1, 1]])   # was (2, 1)


if __name__ == "__main__":
    unittest.main()
