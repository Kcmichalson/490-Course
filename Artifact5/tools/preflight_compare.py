"""Compare two Launch.log files before a multiplayer session.

What it does (plans/m2-live-test-plan.md, Steps 4 and 6): each player
launches the game alone with only X2TacticalCoop ticked, clicks
MULTIPLAYER, and quits. This script reads both Launch.log files and
lists, side by side, the values that have to match for two games to
connect, marking every difference:
  - the game executable (engine version, compile date, changelists)
  - the mod's version line        (X2TC: version ...)
  - the multiplayer match hashes  (X2TC: MP criteria dlc= mods= ini= ...)
  - the installed mod and DLC names
It also checks that neither game ran with the developer console.

It prints only those lines. A Launch.log also holds the computer and
user name; the script never prints them. Keep both logs in local/.

Python 3 standard library only. Reads the two files, writes nothing.

Usage (PowerShell, from the Artifact5 folder):
  python tools\\preflight_compare.py local\\m2-logs\\preflight-host.log local\\m2-logs\\preflight-guest.log
Exit code 0: everything matches. 1: a difference or a missing line.
"""

import argparse
import re
import sys

MISSING = "(missing)"

# label, regular expression with one group, compare-as-a-set-of-names
SINGLE_VALUES = [
    ("Engine version", re.compile(r"Init: Version: (.*)"), False),
    ("Compiled", re.compile(r"Init: Compiled \(64-bit\): (.*)"), False),
    ("Changelist", re.compile(r"Init: Changelist: (.*)"), False),
    ("Fxs changelist", re.compile(r"Init: FxsChangelist: (.*)"), False),
    ("Mod version", re.compile(r"X2TC: version (.*)"), False),
    ("Package hashes", re.compile(r"X2TC: MP criteria packages=(.*)"), False),
    ("Mod names", re.compile(r"X2TC: MP criteria mod names: ?(.*)"), True),
    ("DLC names", re.compile(r"X2TC: MP criteria DLC names: ?(.*)"), True),
    ("MP state", re.compile(r"X2TC: MP state (.*)"), False),
]

CRITERIA_RE = re.compile(
    r"X2TC: MP criteria dlc=(\S*) mods=(\S*) ini=(\S*) devconsole=(\S*) modsinstalled=(\S*)"
)
CRITERIA_LABELS = ["DLC hash", "Mods hash", "INI hash", "Dev console", "Mods installed"]
COMMAND_LINE_RE = re.compile(r"Init: Command line: ?(.*)")


def read_log(path):
    """Launch.log is plain text, or UTF-16 when it holds non-ASCII text."""
    with open(path, "rb") as handle:
        data = handle.read()
    if data[:2] in (b"\xff\xfe", b"\xfe\xff"):
        text = data.decode("utf-16", errors="replace")
    elif data[:3] == b"\xef\xbb\xbf":
        text = data[3:].decode("utf-8", errors="replace")
    else:
        text = data.decode("utf-8", errors="replace")
    return text.splitlines()


def extract(lines):
    """Returns ({label: first value}, [notes about values that changed within the log])."""
    values = {}
    notes = []

    def record(label, value):
        value = value.strip()
        if label not in values:
            values[label] = value
        elif values[label] != value and label != "MP state":
            note = "%s changes within this log: '%s' then '%s'" % (label, values[label], value)
            if note not in notes:
                notes.append(note)

    for line in lines:
        for label, pattern, _ in SINGLE_VALUES:
            match = pattern.search(line)
            if match:
                record(label, match.group(1))
        match = CRITERIA_RE.search(line)
        if match:
            for label, value in zip(CRITERIA_LABELS, match.groups()):
                record(label, value)
        match = COMMAND_LINE_RE.search(line)
        if match:
            record("Command line", match.group(1))
    return values, notes


def name_set(value):
    return sorted(name.strip() for name in value.split(",") if name.strip())


def same(label, left, right, as_names):
    if left == MISSING or right == MISSING:
        return False
    if as_names:
        return name_set(left) == name_set(right)
    return left == right


def shown(value):
    if value == "":
        return "(empty)"
    return value


def main():
    parser = argparse.ArgumentParser(description="Compare two Launch.log files before a session.")
    parser.add_argument("host_log", help="the host's Launch.log")
    parser.add_argument("guest_log", help="the other player's Launch.log")
    args = parser.parse_args()

    host, host_notes = extract(read_log(args.host_log))
    guest, guest_notes = extract(read_log(args.guest_log))

    rows = [(label, as_names) for label, _, as_names in SINGLE_VALUES[:5]]
    rows += [(label, False) for label in CRITERIA_LABELS]
    rows += [(label, as_names) for label, _, as_names in SINGLE_VALUES[5:]]
    rows.append(("Command line", False))

    problems = []
    print("%-16s %-9s host | guest" % ("", ""))
    for label, as_names in rows:
        left = host.get(label, MISSING)
        right = guest.get(label, MISSING)
        if same(label, left, right, as_names):
            mark = "same"
        elif label in ("Command line", "MP state"):
            # Launch arguments and the connectivity flags are shown for reading,
            # not required to be identical.
            mark = "note"
        else:
            mark = "DIFFERENT"
            problems.append("%s: host '%s', guest '%s'" % (label, shown(left), shown(right)))
        print("%-16s %-9s %s | %s" % (label, mark, shown(left), shown(right)))

    for who, values in (("host", host), ("guest", guest)):
        console = values.get("Dev console", MISSING)
        if console != MISSING and console.lower() != "false":
            problems.append("%s: the developer console is on (devconsole=%s)" % (who, console))
        if "allowconsole" in values.get("Command line", "").lower():
            problems.append("%s: launched with -allowConsole" % who)
        if "Mod version" not in values:
            problems.append("%s: no 'X2TC: version' line (mod not loaded, or an older build)" % who)
        if "Mods hash" not in values:
            problems.append(
                "%s: no 'X2TC: MP criteria' line (MULTIPLAYER was not clicked, or the menu did not open)" % who
            )
    for who, notes in (("host", host_notes), ("guest", guest_notes)):
        for note in notes:
            problems.append("%s: %s" % (who, note))

    print()
    if problems:
        print("NOT READY: %d problem(s)" % len(problems))
        for problem in problems:
            print("  - %s" % problem)
        return 1
    print("READY: every compared value matches.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
