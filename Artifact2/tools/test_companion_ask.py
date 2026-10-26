"""Tests for companion.py map mode (--ask): the checks, the retry path,
the tool-call log, the claude command line and its restrictions, and the
files written. Canned answers and streams only; no model is called.

Run from Artifact2/:  py -B -m unittest tools/test_companion_ask.py
"""

import io
import json
import os
import shutil
import sys
import tempfile
import types
import unittest
from contextlib import redirect_stderr, redirect_stdout

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import companion  # noqa: E402
import mapquery  # noqa: E402
from test_mapquery import synthetic, write_map  # noqa: E402

GOOD = """## Placements
Two empires on the two continents.

```json
[
  {"name": "Sunreach", "lat": 15, "lon": 170, "koppen": "Af", "reasons": "Hot and wet all year (26 °C), Köppen Af rainforest."},
  {"name": "Greyhold", "lat": -25, "lon": -75, "koppen": "Cfb", "reasons": "Mild at 12 °C, below the 18 °C tropical line."}
]
```

## Campaign hooks
- A caravan crosses the date line.
- The Greyhold passes freeze.
"""


def with_place(**changes):
    """GOOD with the first placement changed."""
    start = GOOD.index("```json") + len("```json")
    end = GOOD.index("```", start)
    places = json.loads(GOOD[start:end])
    places[0].update(changes)
    return GOOD[:start] + "\n" + json.dumps(places) + "\n" + GOOD[end:]


class MapCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.data = os.path.join(cls.tmp, "map.bin.gz")
        write_map(cls.data, 36, 18, synthetic())
        cls.d = mapquery.MapData.load(cls.data)
        cls.lookup = staticmethod(lambda lat, lon: mapquery.point(cls.d, lat, lon))

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def check(self, text):
        return dict(companion.check_ask(text, self.lookup))


class Checks(MapCase):
    def test_good_answer_passes(self):
        self.assertEqual(self.check(GOOD), {})

    def test_ocean_and_lake_fail(self):
        self.assertEqual(self.check(with_place(lat=0, lon=0))["on land"], ["Sunreach (0, 0) is Ocean, not land"])
        self.assertEqual(self.check(with_place(lat=-35, lon=-45))["on land"], ["Sunreach (-35, -45) is Lake, not land"])

    def test_outside_the_map_fails(self):
        self.assertIn("outside the map", self.check(with_place(lat=95))["on land"][0])

    def test_claimed_code_must_match(self):
        self.assertEqual(self.check(with_place(koppen="Aw"))["climate matches the map"],
                         ["Sunreach (15, 170): koppen Aw claimed, the map says Af"])

    def test_reasons_code_and_temperatures(self):
        msgs = self.check(with_place(reasons="Like a Cfa coast; summers 30 °C."))["climate matches the map"]
        self.assertEqual(msgs, ["Sunreach (15, 170): reasons mention Köppen Cfa, the map says Af",
                                "Sunreach (15, 170): 30 °C is not in the map's data there or a Köppen threshold"])
        self.assertIn("°F", self.check(with_place(reasons="About 79 °F."))["climate matches the map"][0])

    def test_placements_json_problems(self):
        no_block = GOOD.replace("```json", "```")
        self.assertEqual(self.check(no_block)["placements JSON"], ["no ```json block under ## Placements"])
        self.assertIn("doesn't parse", self.check(GOOD.replace('"lat": 15,', '"lat": 15,,'))["placements JSON"][0])
        self.assertEqual(self.check(with_place(lat="15"))["placements JSON"], ["placement 1 (Sunreach): missing or wrong lat"])

    def test_missing_section(self):
        self.assertEqual(self.check(GOOD.replace("## Campaign hooks", "## Hooks"))["sections"],
                         ["missing section: ## Campaign hooks"])


INIT_OK = {"type": "system", "subtype": "init", "model": "m-1", "tools": companion.MAP_TOOLS,
           "mcp_servers": [{"name": "fcm", "status": "connected"}]}
INIT_NO = {"type": "system", "subtype": "init", "model": "m-1", "tools": [], "mcp_servers": []}
TOOL_USE = {"type": "assistant", "message": {"content": [{"type": "tool_use", "name": "mcp__fcm__point",
                                                           "input": {"lat": 15, "lon": 170}}]}}
RESULT = {"type": "result", "is_error": False, "result": GOOD, "modelUsage": {"claude-test": {}}}


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def stream(*msgs):
    return "\n".join(json.dumps(m) for m in msgs) + "\n"


class Stream(unittest.TestCase):
    def test_parse(self):
        info = companion.parse_stream(stream(INIT_OK, TOOL_USE, RESULT).splitlines())
        self.assertEqual((info["mcp_ok"], info["mcp_status"], info["model"]), (True, "connected", "claude-test"))
        self.assertEqual(info["tool_uses"], [{"name": "mcp__fcm__point", "input": {"lat": 15, "lon": 170}}])
        self.assertEqual((info["result"], info["is_error"]), (GOOD, False))

    def test_server_missing(self):
        info = companion.parse_stream(stream(INIT_NO, RESULT).splitlines())
        self.assertEqual((info["mcp_ok"], info["mcp_status"]), (False, "not loaded"))


class CommandLine(MapCase):
    """make_map_ask with subprocess.run replaced: the exact restrictions."""

    def capture(self, outputs, picture=None):
        runs = []
        saved = companion.subprocess.run

        def fake_run(cmd, input=None, cwd=None, env=None, **kw):
            config = json.loads(read(cmd[cmd.index("--mcp-config") + 1]))
            runs.append({"cmd": cmd, "input": input, "config": config, "cwd": cwd, "env": env})
            return types.SimpleNamespace(returncode=0, stdout=outputs[len(runs) - 1], stderr="")
        companion.subprocess.run = fake_run
        try:
            ask = companion.make_map_ask("claude", self.data, picture=picture)
            answer, model, info = ask("PROMPT", os.path.join(self.tmp, "calls.jsonl"))
        finally:
            companion.subprocess.run = saved
        return runs, answer, model, info

    def test_restrictions(self):
        os.environ["ANTHROPIC_API_KEY"] = "test-not-a-key"
        try:
            runs, answer, model, info = self.capture([stream(INIT_OK, TOOL_USE, RESULT)])
        finally:
            del os.environ["ANTHROPIC_API_KEY"]
        cmd = runs[0]["cmd"]
        self.assertEqual(cmd[cmd.index("--tools") + 1], "")
        for flag in ("-p", "--strict-mcp-config", "--disable-slash-commands", "--no-session-persistence", "--safe-mode"):
            self.assertIn(flag, cmd)
        self.assertEqual(cmd[cmd.index("--allowedTools") + 1], "mcp__fcm__point,mcp__fcm__region,mcp__fcm__overview")
        self.assertEqual(cmd[cmd.index("--permission-prompts") + 1], "none")
        servers = runs[0]["config"]["mcpServers"]
        self.assertEqual(list(servers), ["fcm"])
        self.assertEqual(servers["fcm"]["args"][1:4], [os.path.join(os.path.dirname(companion.__file__), "mapquery.py"),
                                                        "serve", os.path.abspath(self.data)])
        self.assertNotIn("ANTHROPIC_API_KEY", runs[0]["env"])
        self.assertEqual(os.listdir(runs[0]["cwd"]) if os.path.exists(runs[0]["cwd"]) else [], [])  # temp folder, gone
        self.assertEqual((answer, model, info["safe_mode"]), (GOOD, "claude-test", True))

    def test_picture_goes_in_as_an_image_block(self):
        png = os.path.join(self.tmp, "pic.png")
        with open(png, "wb") as f:
            f.write(b"\x89PNG fake")
        runs, *_ = self.capture([stream(INIT_OK, RESULT)], picture=png)
        content = json.loads(runs[0]["input"])["message"]["content"]
        self.assertEqual([c["type"] for c in content], ["image", "text"])
        self.assertEqual(content[0]["source"]["media_type"], "image/png")

    def test_falls_back_without_safe_mode(self):
        with redirect_stdout(io.StringIO()):
            runs, answer, model, info = self.capture([stream(INIT_NO, RESULT), stream(INIT_OK, RESULT)])
        self.assertEqual(["--safe-mode" in r["cmd"] for r in runs], [True, False])
        self.assertFalse(info["safe_mode"])

    def test_tool_missing_both_ways_is_an_error(self):
        with redirect_stdout(io.StringIO()), self.assertRaises(RuntimeError):
            self.capture([stream(INIT_NO, RESULT), stream(INIT_NO, RESULT)])


class Retry(MapCase):
    def fake_ask(self, answers, calls_per_attempt=1):
        prompts = []

        def ask(prompt, log_path):
            prompts.append(prompt)
            with open(log_path, "a", encoding="utf-8") as f:  # what the server would log
                for _ in range(calls_per_attempt):
                    f.write(json.dumps({"tool": "point", "arguments": {"lat": 15, "lon": 170}, "ok": True}) + "\n")
            return answers[len(prompts) - 1], "test-model", {"safe_mode": True, "tool_uses": []}
        return ask, prompts

    def test_retry_fixes_it(self):
        ask, prompts = self.fake_ask([with_place(lat=0, lon=0), GOOD])
        ok, answer, model, attempt, failed, calls, info = companion.run_ask("Q?", self.d, ask, self.tmp, log=lambda *_: None)
        self.assertEqual((ok, attempt, answer), (True, 2, GOOD))
        self.assertIn("Sunreach (0, 0) is Ocean, not land", prompts[1])
        self.assertEqual([c["attempt"] for c in calls], [1, 2])

    def test_retry_fails_too(self):
        ask, prompts = self.fake_ask([with_place(koppen="Aw")] * 2)
        ok, *_, failed, calls, info = companion.run_ask("Q?", self.d, ask, self.tmp, log=lambda *_: None)
        self.assertFalse(ok)
        self.assertEqual([n for n, _ in failed], ["climate matches the map"])

    def test_prompt_carries_question_and_map(self):
        ask, prompts = self.fake_ask([GOOD])
        companion.run_ask("Where do my three empires go?", self.d, ask, self.tmp, picture_name="pic.png", log=lambda *_: None)
        self.assertIn("Where do my three empires go?", prompts[0])
        self.assertIn("36 × 18 cells", prompts[0])
        self.assertIn("pic.png", prompts[0])


class Files(MapCase):
    def run_main(self, answers, extra=()):
        q = os.path.join(self.tmp, "question.md")
        with open(q, "w", encoding="utf-8") as f:
            f.write("Place my empires.")
        out = tempfile.mkdtemp(dir=self.tmp)
        it = iter(answers)

        def make(claude, data, model=None, picture=None):
            def ask(prompt, log_path):
                with open(log_path, "a", encoding="utf-8") as f:
                    for tool in ("overview", "point", "point"):
                        f.write(json.dumps({"tool": tool, "arguments": {}, "ok": True}) + "\n")
                return next(it), "test-model", {"safe_mode": True, "tool_uses": []}
            return ask
        saved = companion.make_map_ask, companion.find_claude
        companion.make_map_ask, companion.find_claude = make, (lambda explicit=None: ("claude", "test"))
        try:
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                code = companion.main(["--ask", q, "--map", self.data, "--out", out, *extra])
        finally:
            companion.make_map_ask, companion.find_claude = saved
        return code, out

    def test_pass_writes_answer_header_and_call_log(self):
        code, out = self.run_main([GOOD])
        self.assertEqual(code, 0)
        text = read(os.path.join(out, "answer.md"))
        self.assertTrue(text.startswith("# Map companion: question.md"))
        self.assertIn("**Checks passed:** sections, placements JSON, on land, climate matches the map (attempt 1 of 2)", text)
        self.assertIn("**Map tool calls:** 3 (overview ×1, point ×2)", text)
        self.assertIn("safe mode on", text)
        with open(os.path.join(out, "answer.toolcalls.jsonl"), encoding="utf-8") as f:
            self.assertEqual([json.loads(line)["tool"] for line in f], ["overview", "point", "point"])

    def test_two_failures_keep_raw(self):
        bad = with_place(lat=0, lon=0)
        code, out = self.run_main([bad, bad])
        self.assertEqual(code, 1)
        self.assertFalse(os.path.exists(os.path.join(out, "answer.md")))
        self.assertEqual(read(os.path.join(out, "answer.raw.md")), bad)
        self.assertEqual(len(read(os.path.join(out, "answer.toolcalls.jsonl")).splitlines()), 6)

    def test_argument_errors(self):
        with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            self.assertEqual(companion.main(["--ask", "q.md"]), 2)              # no --map
            self.assertEqual(companion.main(["tile.json", "--map", "x"]), 2)    # tile and map mode mixed
            self.assertEqual(companion.main([]), 2)                             # nothing


if __name__ == "__main__":
    unittest.main()
