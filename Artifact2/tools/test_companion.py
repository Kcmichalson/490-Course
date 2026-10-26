"""Tests for tools/companion.py: the checks, the retry path, and the files
written. Canned replies only; no model is called.

Run from Artifact2/:  py -B -m unittest tools/test_companion.py
(-B: no tools/__pycache__ folder; underscore names don't belong in the repo)
"""

import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import companion  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
TILE = os.path.join(HERE, "examples", "fcm-tile-48.86N_2.35E.json")
SUMMARY = companion.load_summary(TILE)

GOOD = """## Overview
A cool, damp lowland. January is -0.5 °C and July peaks at 15.4 °C; the annual mean is 7.3 °C.
The Köppen class is Dfb. Only May to August pass the 10 °C mark. I am sure winters are long.

## Settlements
River towns with steep roofs.

## Crops and food
Rye, oats, and cabbages.

## Trade
Wool and timber downriver.

## Cultures
A midwinter festival of fire.

## Real-world parallels
- **Parallel:** Medieval Novgorod: wooden streets over mud.
- Parallel: The Hanseatic towns: merchant leagues.
"""


def replace(text, old, new):
    assert old in text, old
    return text.replace(old, new)


class SectionChecks(unittest.TestCase):
    def test_good_reply_passes(self):
        self.assertEqual(companion.run_checks(GOOD, SUMMARY), [])

    def test_missing_section(self):
        bad = replace(GOOD, "## Trade\n", "## Commerce\n")
        self.assertEqual(companion.check_sections(bad), ["missing section: ## Trade"])

    def test_real_reply_passes(self):
        # The example advice.md from the first real run, header stripped.
        with open(os.path.join(HERE, "examples", "advice.md"), encoding="utf-8") as f:
            reply = f.read().split("\n---\n", 1)[1]
        self.assertEqual(companion.run_checks(reply, SUMMARY), [])


class KoppenChecks(unittest.TestCase):
    def test_other_code_fails(self):
        bad = GOOD + "\nIt is close to Cfb.\n"
        self.assertEqual(companion.check_koppen(bad, "Dfb"), ["Köppen code Cfb stated, but the tile is Dfb"])

    def test_am_and_h_only_after_koppen(self):
        self.assertEqual(companion.check_koppen("I am here. H is a letter.", "Dfb"), [])
        self.assertEqual(companion.check_koppen("Köppen Am nearby.", "Dfb"), ["Köppen code Am stated, but the tile is Dfb"])

    def test_codes_inside_words_ignored(self):
        self.assertEqual(companion.check_koppen("Afghan ETched EFfort", "Dfb"), [])


class TemperatureChecks(unittest.TestCase):
    def test_value_not_in_data_fails(self):
        msgs = companion.check_temperatures("Summer highs reach 25 °C.", SUMMARY)
        self.assertEqual(msgs, ["temperature 25 °C is not in the tile's data or a Köppen threshold"])

    def test_both_range_ends_checked(self):
        self.assertEqual(companion.temperatures_in("from −0.5 to 15.4 °C and 10–30°C"), [-0.5, 15.4, 10.0, 30.0])
        msgs = companion.check_temperatures("between 10–30 °C", SUMMARY)
        self.assertEqual(msgs, ["temperature 30 °C is not in the tile's data or a Köppen threshold"])

    def test_thresholds_and_rounding_allowed(self):
        text = "Not tropical (18 °C), no hot summer (22 °C), C/D at −3 °C or 0 °C; July about 15 °C."
        self.assertEqual(companion.check_temperatures(text, SUMMARY), [])

    def test_fahrenheit_fails(self):
        self.assertIn("temperature in °F (only °C is allowed)", companion.check_temperatures("About 59 °F.", SUMMARY))

    def test_bare_degrees_are_not_temperatures(self):
        self.assertEqual(companion.temperatures_in("Wind from 232°."), [])


class ParallelChecks(unittest.TestCase):
    def test_unlabeled_parallel_fails(self):
        bad = replace(GOOD, "- Parallel: The Hanseatic", "- The Hanseatic")
        self.assertEqual(companion.check_parallels(bad), ["parallel not labeled 'Parallel:': The Hanseatic towns: merchant leagues."])

    def test_real_world_wording_outside_fails(self):
        bad = replace(GOOD, "Wool and timber downriver.", "Historically, wool went downriver.")
        self.assertEqual(companion.check_parallels(bad), ["real-world wording 'historically' outside Real-world parallels (in ## trade)"])

    def test_no_bullets_fails(self):
        bad = GOOD.split("## Real-world parallels")[0] + "## Real-world parallels\nNovgorod.\n"
        self.assertEqual(companion.check_parallels(bad), ["Real-world parallels has no bullet points"])


class RetryPath(unittest.TestCase):
    def fake_ask(self, replies):
        prompts = []

        def ask(prompt):
            prompts.append(prompt)
            return replies[len(prompts) - 1], "test-model"
        return ask, prompts

    def test_pass_first_time_asks_once(self):
        ask, prompts = self.fake_ask([GOOD])
        ok, reply, model, attempt, failed = companion.run_companion(SUMMARY, ask, log=lambda *_: None)
        self.assertEqual((ok, attempt, failed, len(prompts)), (True, 1, [], 1))

    def test_retry_fixes_it(self):
        bad = GOOD + "\nSummers reach 25 °C.\n"
        ask, prompts = self.fake_ask([bad, GOOD])
        ok, reply, model, attempt, failed = companion.run_companion(SUMMARY, ask, log=lambda *_: None)
        self.assertEqual((ok, attempt, reply), (True, 2, GOOD))
        # The retry sends the failure and the previous reply back.
        self.assertIn("temperature 25 °C is not in the tile's data", prompts[1])
        self.assertIn("Summers reach 25 °C.", prompts[1])

    def test_retry_fails_too(self):
        bad = GOOD + "\nIt is close to Cfb.\n"
        ask, prompts = self.fake_ask([bad, bad])
        ok, reply, model, attempt, failed = companion.run_companion(SUMMARY, ask, log=lambda *_: None)
        self.assertEqual((ok, attempt, len(prompts)), (False, 2, 2))
        self.assertEqual([name for name, _ in failed], ["Köppen code"])


class MainFiles(unittest.TestCase):
    def run_main(self, replies):
        calls = iter(replies)
        saved = companion.make_ask, companion.find_claude
        companion.make_ask = lambda claude, model=None: (lambda prompt: (next(calls), "test-model"))
        companion.find_claude = lambda explicit=None: ("claude", "test")
        try:
            out = tempfile.mkdtemp()
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()) as err:
                code = companion.main([TILE, "--out", out])
            return code, out, err.getvalue()
        finally:
            companion.make_ask, companion.find_claude = saved

    def test_pass_writes_advice_with_header(self):
        code, out, _ = self.run_main([GOOD])
        self.assertEqual(code, 0)
        with open(os.path.join(out, "advice.md"), encoding="utf-8") as f:
            text = f.read()
        self.assertTrue(text.startswith("# Climate companion: 48.86°N, 2.35°E"))
        self.assertIn("model test-model", text)
        self.assertIn("**Checks passed:** sections, Köppen code, temperatures, parallels labeled (attempt 1 of 2)", text)
        self.assertFalse(os.path.exists(os.path.join(out, "advice.raw.md")))

    def test_two_failures_keep_raw_and_exit_1(self):
        bad = GOOD + "\nIt is close to Cfb.\n"
        code, out, err = self.run_main([bad, bad])
        self.assertEqual(code, 1)
        self.assertFalse(os.path.exists(os.path.join(out, "advice.md")))
        with open(os.path.join(out, "advice.raw.md"), encoding="utf-8") as f:
            self.assertEqual(f.read(), bad)
        self.assertIn("[Köppen code] Köppen code Cfb stated", err)

    def test_bad_json_exits_2(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
            json.dump({"format": "something-else"}, f)
        with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            self.assertEqual(companion.main([f.name]), 2)
        os.unlink(f.name)


if __name__ == "__main__":
    unittest.main()
