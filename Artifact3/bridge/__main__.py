"""Run the bridge: py -m bridge [--port N]  (from Artifact3/). Ctrl+C stops it."""

import argparse
import sys

from bridge import constants as C
from bridge.server import make_server


def main(argv=None):
    parser = argparse.ArgumentParser(prog="py -m bridge")
    parser.add_argument("--port", type=int, default=C.PORT)
    args = parser.parse_args(argv)
    try:
        server = make_server(port=args.port)
    except OSError as exc:
        print("Can't listen on %s:%d (%s). Is another bridge running?"
              % (C.HOST, args.port, exc), file=sys.stderr, flush=True)
        return 1
    print("LANCER bridge on http://%s:%d  (Ctrl+C to stop)"
          % (C.HOST, server.server_address[1]), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    print("Bridge stopped.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
