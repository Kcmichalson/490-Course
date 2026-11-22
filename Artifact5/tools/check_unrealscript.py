"""Rough static checks for the mod's UnrealScript classes, run before every build handoff.

It doesn't compile anything (Kc builds with the SDK); it catches mistakes that
have broken builds before:
  - unbalanced {} () [] outside strings and comments, and unterminated strings;
  - a `local` declared after the first statement of a function (UnrealScript
    needs locals at the top);
  - a run-time `default.X = ...` or `class'C'.default.X = ...` (outside
    defaultproperties) where X isn't a config variable of that class.
    UnrealScript refuses these ("Can't change default values of non-config
    properties": the Stage 2 and 0.8.0 build errors). An assignment on a class
    outside the mod can't be checked and is reported for a manual look.

Usage (from the Artifact5 folder):
    python tools\\check_unrealscript.py              (every class in mod/)
    python tools\\check_unrealscript.py FILE.uc ...  (only these files)

Prints one line per problem and "problems: N"; exits with 1 if N > 0.
Python 3 standard library only. Not covered: types, names, inheritance, and a
local named after a parent class's field (e.g. `Owner` in an Actor), which the
compiler only warns about.
"""
import pathlib
import re
import sys

DEFAULT_CLASSES = pathlib.Path(__file__).resolve().parent.parent / "mod" / "X2TacticalCoop" / "Src" / "X2TacticalCoop" / "Classes"


def strip(src):
    """The source with comments and string contents blanked (line breaks kept),
    or (None, error) for an unterminated string."""
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if src.startswith('//', i):
            j = src.find('\n', i)
            j = n if j < 0 else j
            out.append(' ' * (j - i))
            i = j
            continue
        if src.startswith('/*', i):
            j = src.find('*/', i)
            j = n if j < 0 else j + 2
            out.append(re.sub(r'[^\n]', ' ', src[i:j]))
            i = j
            continue
        if c in '"\'':
            j = i + 1
            while j < n and src[j] != c and src[j] != '\n':
                j += 2 if src[j] == '\\' else 1
            if j >= n or src[j] != c:
                return None, f'unterminated {c} at line {src.count(chr(10), 0, i) + 1}'
            out.append(c + ' ' * (j - i - 1) + c)
            i = j + 1
            continue
        out.append(c)
        i += 1
    return ''.join(out), None


DEFAULT_ASSIGN = re.compile(
    r"(?:class\s*'(\w+)'\s*\.\s*)?\bdefault\s*\.\s*(\w+)\s*(?:\[[^\]]*\])?\s*(?:\.\s*\w+\s*)*=(?!=)", re.I)
FUNCTION_START = re.compile(
    r'^(simulated\s+|static\s+|private\s+|protected\s+|final\s+|native\s+)*(function|event)\b')


def main(argv):
    paths = [pathlib.Path(p) for p in argv] if argv else sorted(DEFAULT_CLASSES.glob('*.uc'))
    if not paths:
        print('no .uc files found')
        return 1
    sources, problems = {}, 0

    # Pass 1: strip each file; each class's config variables.
    config_vars, class_of = {}, {}
    for path in paths:
        code, err = strip(path.read_text(encoding='utf-8'))
        sources[path] = (code, err)
        if code is None:
            continue
        m = re.search(r'^\s*class\s+(\w+)', code, re.M | re.I)
        cname = m.group(1).lower() if m else path.stem.lower()
        class_of[path] = cname
        names = set()
        for d in re.finditer(r'^\s*var\s*(\([^)]*\))?\s*([^;]*?)\s*;', code, re.M | re.I):
            if re.search(r'\bconfig\b', d.group(2), re.I):
                names.add(d.group(2).split()[-1].split('[')[0].lower())
        config_vars[cname] = names

    for path in paths:
        code, err = sources[path]
        name = path.name
        if err:
            print(name, err)
            problems += 1
            continue

        # Run-time default. assignments on non-config variables.
        dp = re.search(r'^\s*defaultproperties\b', code, re.M | re.I)
        body = code[:dp.start()] if dp else code
        for m in DEFAULT_ASSIGN.finditer(body):
            target = (m.group(1) or class_of[path]).lower()
            ln = body.count('\n', 0, m.start()) + 1
            if target not in config_vars:
                print(name, ln, f"default.{m.group(2)} assigned on {m.group(1)}, not a class checked here: make sure it's a config variable")
                problems += 1
            elif m.group(2).lower() not in config_vars[target]:
                print(name, ln, f"default.{m.group(2)} assigned at run time but it isn't a config variable of {target}")
                problems += 1

        # Brackets.
        for o, c in ('{}', '()', '[]'):
            if code.count(o) != code.count(c):
                print(name, f'unbalanced {o}{c}: {code.count(o)} vs {code.count(c)}')
                problems += 1

        # Locals after the first statement of a function.
        in_func, depth, seen_stmt, fname, fdepth = False, 0, False, '', 0
        for ln, line in enumerate(code.split('\n'), 1):
            s = line.strip()
            if FUNCTION_START.match(s) and depth <= 1:
                fname, in_func, seen_stmt, fdepth = s[:60], True, False, depth
                continue
            if in_func:
                if s.startswith('local '):
                    if seen_stmt:
                        print(name, ln, 'local after a statement in', fname)
                        problems += 1
                elif s and s not in ('{', '}'):
                    seen_stmt = True
            depth += line.count('{') - line.count('}')
            if in_func and depth <= fdepth and '}' in line:
                in_func = False

    print(f'checked {len(paths)} files; problems: {problems}')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
