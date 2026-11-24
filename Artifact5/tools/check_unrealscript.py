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

  - (0.8.4b, after the build broke on X2TC_CoopMenuBar.Attach) with the SDK's
    SrcOrig folder present (read only), against each class's parents:
      - a local or a function parameter named after a field of the class or
        any parent (e.g. `Owner` in an Actor, `Y` or `Screen` in a UIPanel;
        the compiler warns, and CLAUDE.md forbids it);
      - a function that redefines a parent's function or event with another
        return type, parameter count or static-ness (the compiler's
        "Redefinition of 'function X' differs from original" error).
    Parents come from the mod's classes and SrcOrig (not the Highlander's
    copies). The parsing is rough: it can miss cases, so the build stays
    the final check.

Prints one line per problem and "problems: N"; exits with 1 if N > 0.
Python 3 standard library only. Not covered: types, and other name lookups.
"""
import pathlib
import re
import sys

DEFAULT_CLASSES = pathlib.Path(__file__).resolve().parent.parent / "mod" / "X2TacticalCoop" / "Src" / "X2TacticalCoop" / "Classes"
SDK_SRCORIG = pathlib.Path(r"D:\SteamLibrary\steamapps\common\XCOM 2 War of the Chosen SDK\Development\SrcOrig")


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


# ---- Inherited names (0.8.4b) ----

MODIFIERS = {'simulated', 'static', 'private', 'protected', 'final', 'native', 'public',
             'event', 'function', 'iterator', 'latent', 'singular', 'exec', 'reliable',
             'unreliable', 'server', 'client', 'noexport', 'const', 'protectedwrite',
             'privatewrite', 'noexportheader', 'virtual', 'coerce'}
PARAM_MODIFIERS = {'optional', 'out', 'const', 'coerce', 'skip', 'init', 'ref'}


def blank_blocks(code, keyword):
    """Blanks each `keyword ... { ... }` block (struct bodies, cpptext,
    defaultproperties), keeping line breaks."""
    out = code
    for m in re.finditer(r'\b' + keyword + r'\b', code, re.I):
        i = code.find('{', m.end())
        if i < 0:
            continue
        semi = code.find(';', m.end())
        if keyword == 'struct' and 0 <= semi < i:
            continue  # "struct X;" or a struct type in a declaration
        depth, j = 0, i
        while j < len(code):
            if code[j] == '{':
                depth += 1
            elif code[j] == '}':
                depth -= 1
                if depth == 0:
                    break
            j += 1
        out = out[:m.start()] + re.sub(r'[^\n]', ' ', out[m.start():j + 1]) + out[j + 1:]
    return out


def clean(code):
    # A struct's C++ type tag ("struct {QWORD} qword") isn't its body.
    code = re.sub(r'(\bstruct\s+(?:\w+\s+)*)(\{[^{}\n]*\})',
                  lambda m: m.group(1) + ' ' * len(m.group(2)), code, flags=re.I)
    for kw in ('structcpptext', 'cpptext', 'structdefaultproperties', 'defaultproperties', 'struct'):
        code = blank_blocks(code, kw)
    return code


def field_names(code):
    names = set()
    for d in re.finditer(r'^\s*var\b\s*(\([^)]*\))?([^;]*);', code, re.M | re.I):
        text = re.sub(r'<[^<>]*>', '', d.group(2))
        text = re.sub(r'\{[^}]*\}', '', text)
        text = re.sub(r'\[[^\]]*\]', '', text)
        parts = [p.strip() for p in text.split(',') if p.strip()]
        if not parts:
            continue
        names.add(parts[0].split()[-1].lower())
        for p in parts[1:]:
            names.add(p.split()[0].lower())
    return names


def functions(code):
    """[(name, return type, param names, static?, line)] for function/event declarations."""
    found = []
    for m in re.finditer(r'\b(function|event)\s+', code, re.I):
        start = code.rfind('\n', 0, m.start()) + 1
        prefix = code[start:m.start()].lower()
        if re.search(r'[;=(]', prefix):
            continue
        k = code.find('(', m.end())
        if k < 0:
            continue
        head = code[m.end():k]
        if re.search(r'[;{}]', head):
            continue
        head = re.sub(r'\(\s*\d*\s*\)', ' ', head)  # native(123)
        tokens = [t for t in re.sub(r'<[^<>]*>', lambda x: x.group(0).replace(' ', ''), head).split()
                  if t.lower() not in MODIFIERS]
        if not tokens:
            continue
        name = tokens[-1]
        ret = ''.join(tokens[:-1]).lower()
        depth, j = 0, k
        while j < len(code):
            if code[j] == '(':
                depth += 1
            elif code[j] == ')':
                depth -= 1
                if depth == 0:
                    break
            j += 1
        params = []
        for part in re.sub(r'<[^<>]*>', '', code[k + 1:j]).split(','):
            part = part.split('=')[0]
            words = [w for w in re.findall(r'\w+', part) if w.lower() not in PARAM_MODIFIERS]
            if words:
                params.append(words[-1].lower())
        is_static = 'static' in prefix.split() or 'static' in head.lower().split()
        found.append((name.lower(), ret, params, is_static, code.count('\n', 0, m.start()) + 1))
    return found


class Parents:
    def __init__(self, mod_sources):
        self.mod = mod_sources            # class name -> cleaned code
        self.files = {}
        if SDK_SRCORIG.is_dir():
            for f in SDK_SRCORIG.glob('*/Classes/*.uc'):
                self.files.setdefault(f.stem.lower(), f)
        self.cache = {}

    def code(self, cname):
        if cname in self.mod:
            return self.mod[cname]
        if cname not in self.cache:
            f = self.files.get(cname)
            text = None
            if f:
                raw, _ = strip(f.read_text(encoding='utf-8', errors='replace'))
                text = clean(raw) if raw is not None else None
            self.cache[cname] = text
        return self.cache[cname]

    def parent(self, cname):
        c = self.code(cname)
        if c is None:
            return None
        m = re.search(r'^\s*class\s+\w+\s+extends\s+(\w+)', c, re.M | re.I)
        return m.group(1).lower() if m else None

    def chain(self, cname):
        seen, out, p = set(), [], self.parent(cname)
        while p and p not in seen and len(out) < 40:
            seen.add(p)
            out.append(p)
            p = self.parent(p)
        return out


def check_inherited(paths, sources, class_of):
    if not SDK_SRCORIG.is_dir():
        print('note: SDK SrcOrig not found; inherited-name checks skipped')
        return 0
    mod = {}
    for path in paths:
        code, err = sources[path]
        if code is not None:
            mod[class_of[path]] = clean(code)
    parents = Parents(mod)
    problems = 0
    for path in paths:
        cname = class_of.get(path)
        if cname not in mod:
            continue
        code = mod[cname]
        chain = parents.chain(cname)
        fields = field_names(code)
        inherited_funcs = {}
        for p in chain:
            pc = parents.code(p)
            if pc is None:
                continue
            fields |= field_names(pc)
            for f in functions(pc):
                inherited_funcs.setdefault(f[0], (p, f))
        for m in re.finditer(r'^\s*local\b([^;]*);', code, re.M | re.I):
            text = re.sub(r'<[^<>]*>', '', m.group(1))
            text = re.sub(r'\[[^\]]*\]', '', text)
            parts = [x.strip() for x in text.split(',') if x.strip()]
            names = ([parts[0].split()[-1]] if parts else []) + [x.split()[0] for x in parts[1:]]
            ln = code.count('\n', 0, m.start()) + 1
            for n in names:
                if n.lower() in fields:
                    print(path.name, ln, f"local '{n}' has the name of a field of {cname} or a parent class")
                    problems += 1
        for name, ret, params, is_static, ln in functions(code):
            for prm in params:
                if prm in fields:
                    print(path.name, ln, f"parameter '{prm}' of {name} has the name of a field of {cname} or a parent class")
                    problems += 1
            if name in inherited_funcs:
                owner, (_, pret, pparams, pstatic, _) = inherited_funcs[name]
                diffs = []
                if pret != ret:
                    diffs.append(f"return type '{ret or 'none'}' vs '{pret or 'none'}'")
                if len(pparams) != len(params):
                    diffs.append(f"{len(params)} parameters vs {len(pparams)}")
                if pstatic != is_static:
                    diffs.append('static vs not static')
                if diffs:
                    print(path.name, ln, f"function {name} redefines {owner}'s with a different signature ({'; '.join(diffs)})")
                    problems += 1
    return problems


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

    # Inherited names (0.8.4b): checked over every class, so parents in the mod resolve.
    if not argv:
        problems += check_inherited(paths, sources, class_of)
    else:
        all_paths = sorted(DEFAULT_CLASSES.glob('*.uc'))
        all_sources, all_class_of = {}, {}
        for path in all_paths:
            code, err = strip(path.read_text(encoding='utf-8'))
            all_sources[path] = (code, err)
            m = re.search(r'^\s*class\s+(\w+)', code or '', re.M | re.I)
            all_class_of[path] = m.group(1).lower() if m else path.stem.lower()
        chosen = [p for p in all_paths if p.resolve() in {q.resolve() for q in paths}]
        problems += check_inherited(chosen, all_sources, all_class_of) if chosen else 0

    print(f'checked {len(paths)} files; problems: {problems}')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
