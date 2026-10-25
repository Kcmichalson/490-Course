import json
import unittest
from pathlib import Path

from bridge import report, snapshot

FIXTURES = Path(__file__).resolve().parent / "fixtures"
RECEIVED_AT = "2026-10-24T22:15:03Z"


def load_payload(name):
    with open(FIXTURES / name, encoding="utf-8") as f:
        return json.load(f)


class ReportTests(unittest.TestCase):
    def test_golden_report(self):
        snap = snapshot.build_snapshot(load_payload("payload_pointy.json"), RECEIVED_AT, 1)
        with open(FIXTURES / "report_pointy.txt", encoding="utf-8", newline="") as f:
            golden = f.read()
        self.assertEqual(report.render(snap), golden)

    def test_empty_board(self):
        snap = snapshot.build_snapshot(
            {"payload_version": 1, "grid": {"type": 3, "sizeX": 1.0, "sizeY": 1.0},
             "objects": []}, RECEIVED_AT, 1)
        text = report.render(snap)
        self.assertIn("flat-top (TTS type 3)", text)
        self.assertIn("UNITS (0)\nnone", text)
        self.assertIn("OBJECTIVES (0)\nnone", text)
        self.assertIn("DISTANCES (opposing sides, hexes)\nnone", text)
        self.assertTrue(text.endswith("WARNINGS (0)\nnone\n"))

    def test_order_does_not_depend_on_payload_order(self):
        payload = load_payload("payload_pointy.json")
        a = report.render(snapshot.build_snapshot(payload, RECEIVED_AT, 1))
        payload["objects"].reverse()
        b = report.render(snapshot.build_snapshot(payload, RECEIVED_AT, 1))
        self.assertEqual(a, b)

    def test_warnings_and_half_size_shown(self):
        snap = snapshot.build_snapshot(
            {"payload_version": 1, "grid": {"type": 2, "sizeX": 2.0, "sizeY": 2.0},
             "objects": [{"guid": "d1", "name": "Drone", "description": "AIT: Unit\nSize: 1/2",
                          "position": {"x": 0, "y": 0, "z": 0}}]}, RECEIVED_AT, 1)
        text = report.render(snap)
        self.assertIn("[unknown] Drone  Size 1/2", text)
        self.assertIn("WARNINGS (1)\n'Drone' has no Side; using unknown", text)


if __name__ == "__main__":
    unittest.main()
