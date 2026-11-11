"""Package the built X2TacticalCoop mod folder for another player.

What it does (plans/m2-live-test-plan.md, Step 4):
  - reads the built mod folder in the game's Mods folder (read only)
  - checks it is the build the source describes (see "Checks" below)
  - writes  local/release/X2TacticalCoop-<version>.zip
    and     local/release/X2TacticalCoop-<version>.sha256.txt
    (the zip's SHA-256 and one SHA-256 per file)

The zip holds one top folder, X2TacticalCoop/, to unzip into the other
player's ...\\XCom2-WarOfTheChosen\\XComGame\\Mods\\ folder.

Checks, each of which stops the script:
  - the version given with --version equals X2TC_VERSION in the source
  - SHOW_TEST_BUTTONS is false in the source (unless --allow-test-build)
  - the built folder's copy of every class file is byte-for-byte the
    source in mod/ (otherwise the mod was edited after the last build)
  - the compiled script is not older than the newest class file

Python 3 standard library only. local/ is in .gitignore, so the zip is
never committed.

Usage (PowerShell, from the Artifact5 folder):
  python tools\\package_mod.py --mods-dir "<game>\\XCom2-WarOfTheChosen\\XComGame\\Mods" --version 0.2.0
  add --dry-run to run the checks and list the files without writing
"""

import argparse
import datetime
import hashlib
import re
import sys
import zipfile
from pathlib import Path

MOD_NAME = "X2TacticalCoop"
ARTIFACT_ROOT = Path(__file__).resolve().parent.parent
SOURCE_CLASSES = ARTIFACT_ROOT / "mod" / MOD_NAME / "Src" / MOD_NAME / "Classes"
VERSION_FILE = SOURCE_CLASSES / ("X2DownloadableContentInfo_" + MOD_NAME + ".uc")
BUTTONS_FILE = SOURCE_CLASSES / "X2TC_MainMenuListener.uc"
RELEASE_DIR = ARTIFACT_ROOT / "local" / "release"

VERSION_RE = re.compile(r'const\s+X2TC_VERSION\s*=\s*"([^"]+)"\s*;')
BUTTONS_RE = re.compile(r"const\s+SHOW_TEST_BUTTONS\s*=\s*(true|false)\s*;", re.IGNORECASE)


class PackageError(Exception):
    """A check failed; nothing was written."""


def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def find_in_source(path, pattern, what):
    if not path.is_file():
        raise PackageError("Source file not found: %s" % path)
    match = pattern.search(path.read_text(encoding="utf-8", errors="replace"))
    if match is None:
        raise PackageError("Could not find %s in %s" % (what, path))
    return match.group(1)


def check_source(version, allow_test_build):
    source_version = find_in_source(VERSION_FILE, VERSION_RE, "X2TC_VERSION")
    if source_version != version:
        raise PackageError(
            "Version mismatch: --version %s, but the source says %s" % (version, source_version)
        )
    buttons = find_in_source(BUTTONS_FILE, BUTTONS_RE, "SHOW_TEST_BUTTONS").lower()
    if buttons == "true" and not allow_test_build:
        raise PackageError(
            "SHOW_TEST_BUTTONS is true: this is the test build. Set it to false and "
            "rebuild, or pass --allow-test-build."
        )
    return buttons == "true"


def check_built_folder(built):
    if not built.is_dir():
        raise PackageError("Built mod folder not found: %s" % built)
    script = built / "Script" / (MOD_NAME + ".u")
    for needed in (built / (MOD_NAME + ".XComMod"), script):
        if not needed.is_file():
            raise PackageError("Missing in the built folder: %s" % needed)

    built_classes = built / "Src" / MOD_NAME / "Classes"
    source_files = sorted(SOURCE_CLASSES.glob("*.uc"))
    if not source_files:
        raise PackageError("No class files found in %s" % SOURCE_CLASSES)
    newest_source = 0.0
    for source in source_files:
        copy = built_classes / source.name
        if not copy.is_file():
            raise PackageError("Not in the built folder (rebuild): %s" % source.name)
        if copy.read_bytes() != source.read_bytes():
            raise PackageError("Changed since the last build (rebuild): %s" % source.name)
        newest_source = max(newest_source, source.stat().st_mtime)
    extra = sorted(p.name for p in built_classes.glob("*.uc") if not (SOURCE_CLASSES / p.name).is_file())
    if extra:
        raise PackageError("In the built folder but not in mod/ (rebuild): %s" % ", ".join(extra))
    if script.stat().st_mtime < newest_source:
        raise PackageError("The compiled script is older than the newest class file (rebuild).")


def list_files(built):
    files = sorted(p for p in built.rglob("*") if p.is_file())
    return [(p, p.relative_to(built).as_posix()) for p in files]


def write_zip(zip_path, entries):
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path, relative in entries:
            archive.write(path, arcname=MOD_NAME + "/" + relative)


def verify_zip(zip_path, hashes):
    with zipfile.ZipFile(zip_path) as archive:
        bad = archive.testzip()
        if bad is not None:
            raise PackageError("The zip failed its own check at %s" % bad)
        names = sorted(archive.namelist())
        expected = sorted(MOD_NAME + "/" + relative for relative in hashes)
        if names != expected:
            raise PackageError("The zip's file list differs from the built folder.")
        for relative, wanted in hashes.items():
            got = hashlib.sha256(archive.read(MOD_NAME + "/" + relative)).hexdigest()
            if got != wanted:
                raise PackageError("The zip's copy differs from the built file: %s" % relative)


def main():
    parser = argparse.ArgumentParser(description="Zip the built %s folder with checksums." % MOD_NAME)
    parser.add_argument("--mods-dir", required=True, help="the game's XComGame\\Mods folder")
    parser.add_argument("--version", required=True, help="must equal X2TC_VERSION in the source")
    parser.add_argument("--dry-run", action="store_true", help="check and list only; write nothing")
    parser.add_argument("--allow-test-build", action="store_true", help="accept SHOW_TEST_BUTTONS = true")
    parser.add_argument("--force", action="store_true", help="replace an existing zip of this version")
    args = parser.parse_args()

    built = Path(args.mods_dir) / MOD_NAME
    try:
        is_test_build = check_source(args.version, args.allow_test_build)
        check_built_folder(built)
        entries = list_files(built)
        hashes = {relative: sha256_of(path) for path, relative in entries}

        print("%s %s%s" % (MOD_NAME, args.version, " (TEST BUILD)" if is_test_build else ""))
        print("Built folder: %s" % built)
        for path, relative in entries:
            print("  %s  %8d  %s" % (hashes[relative], path.stat().st_size, relative))

        if args.dry_run:
            print("Dry run: checks passed, nothing written.")
            return 0

        suffix = "-test" if is_test_build else ""
        zip_path = RELEASE_DIR / ("%s-%s%s.zip" % (MOD_NAME, args.version, suffix))
        list_path = RELEASE_DIR / ("%s-%s%s.sha256.txt" % (MOD_NAME, args.version, suffix))
        if zip_path.exists() and not args.force:
            raise PackageError(
                "%s already exists. If that zip was already sent, change the version "
                "instead; otherwise pass --force." % zip_path
            )
        RELEASE_DIR.mkdir(parents=True, exist_ok=True)
        write_zip(zip_path, entries)
        verify_zip(zip_path, hashes)
        zip_hash = sha256_of(zip_path)

        created = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        lines = [
            "%s %s%s" % (MOD_NAME, args.version, " (TEST BUILD)" if is_test_build else ""),
            "Packaged: %s" % created,
            "",
            "SHA-256 of %s:" % zip_path.name,
            zip_hash,
            "",
            "SHA-256 of each file inside (size in bytes):",
        ]
        for path, relative in entries:
            lines.append("%s  %8d  %s/%s" % (hashes[relative], path.stat().st_size, MOD_NAME, relative))
        list_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

        print("Wrote %s" % zip_path)
        print("Wrote %s" % list_path)
        print("Zip SHA-256: %s" % zip_hash)
        return 0
    except PackageError as error:
        print("STOPPED: %s" % error, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
