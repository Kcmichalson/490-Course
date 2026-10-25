"""Talk to a running bridge on 127.0.0.1 (standard library only).

  py tools/bridge_client.py post tests/fixtures/payload_pointy.json
  py tools/bridge_client.py post-raw '{"not": "valid"}'
  py tools/bridge_client.py get /report

The host is fixed to 127.0.0.1 and proxies are disabled, so nothing leaves
this computer.
"""

import argparse
import sys
import urllib.error
import urllib.request

HOST = "127.0.0.1"
PORT = 8765


def request(method, path, body=None, port=PORT):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    req = urllib.request.Request("http://%s:%d%s" % (HOST, port, path),
                                 data=body, method=method)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with opener.open(req, timeout=5) as resp:
            return resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8")


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=PORT)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("post").add_argument("file")
    sub.add_parser("post-raw").add_argument("body")
    sub.add_parser("get").add_argument("path")
    args = parser.parse_args(argv)
    if args.cmd == "post":
        with open(args.file, "rb") as f:
            status, text = request("POST", "/tts", f.read(), args.port)
    elif args.cmd == "post-raw":
        status, text = request("POST", "/tts", args.body.encode("utf-8"),
                               args.port)
    else:
        status, text = request("GET", args.path, port=args.port)
    print("HTTP %d" % status)
    print(text, end="" if text.endswith("\n") else "\n")
    return 0 if status < 400 else 1


if __name__ == "__main__":
    sys.exit(main())
