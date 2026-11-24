#!/usr/bin/env python3
"""Check the no-JavaScript rule, static assets, manifest paths, weight, and optional upstream parity.

Uses only the Python standard library. Run from any directory:
    python3 tools/check_frontend.py
    python3 tools/check_frontend.py --base <upstream-commit>
"""

import argparse
import gzip
import json
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.refs = []
        self.downloads = set()
        self.css = []
        self.errors = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.append(attrs["id"])
        for key in ("src", "href"):
            if attrs.get(key):
                self.refs.append((tag, attrs[key]))
        if tag == "link" and attrs.get("rel") == "stylesheet":
            self.css.append(attrs["href"])
        if tag == "a":
            href = attrs.get("href", "")
            if "/releases/download/" in href:
                self.downloads.add(href)
            if attrs.get("target") == "_blank":
                if not {"noopener", "noreferrer"}.issubset(set(attrs.get("rel", "").split())):
                    self.errors.append("New-tab link lacks noopener/noreferrer: " + href)
        if tag == "script":
            self.errors.append("JavaScript is not allowed: <script> found")
        for key, value in attrs.items():
            if key.startswith("on"):
                self.errors.append(f"JavaScript is not allowed: {key} attribute on <{tag}>")
            if isinstance(value, str) and value.strip().lower().startswith("javascript:"):
                self.errors.append(f"JavaScript is not allowed: javascript: URL on <{tag}>")


class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


def setup_commands(html):
    match = re.search(r'<code id="setup-code">(.*?)</code>', html, re.S)
    if not match:
        match = re.search(r"<pre><code>(.*?)</code></pre>", html, re.S)
    if not match:
        raise ValueError("Setup commands are missing")
    content = re.sub(r'<span class="prompt"[^>]*>.*?</span>', "", match[1], flags=re.S)
    text = Text()
    text.feed(content)
    return "".join(text.parts).strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", help="Git commit/ref for compatibility and download checks")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    html = (root / "index.html").read_text()
    page = Page()
    page.feed(html)
    errors = list(page.errors)
    js_files = [str(f.relative_to(root)) for pattern in ("*.js", "*.mjs", "*.cjs")
                for f in root.rglob(pattern) if ".git" not in f.parts]
    if js_files:
        errors.append("JavaScript files are not allowed: " + ", ".join(sorted(js_files)))
    if len(page.ids) != len(set(page.ids)):
        errors.append("Duplicate HTML IDs")

    for tag, url in page.refs:
        parsed = urlsplit(url)
        if parsed.scheme or parsed.netloc:
            continue
        if url.startswith("#"):
            if unquote(url[1:]) not in page.ids:
                errors.append("Missing fragment target: " + url)
            continue
        target = (root / unquote(parsed.path).lstrip("/")).resolve()
        if not target.is_relative_to(root):
            errors.append("Asset escapes the repository: " + url)
        elif not target.is_file():
            errors.append("Missing local resource: " + url)

    share = re.search(r'<meta property="og:image" content="https://zclassic\.org/([^"]+)"', html)
    if not share or not (root / share[1]).is_file():
        errors.append("og:image must point to a file in this repository")

    assets = root / "frontend-zcl"
    manifest = json.loads((assets / "site.webmanifest").read_text())
    for mount in ("/", "/preview/"):
        manifest_url = "https://example.invalid" + mount + "frontend-zcl/site.webmanifest"
        expected = "https://example.invalid" + mount
        for field in ("start_url", "scope"):
            if urljoin(manifest_url, manifest.get(field, "")) != expected:
                errors.append("Manifest " + field + " does not resolve to " + mount)
        for icon in manifest.get("icons", []):
            path = urlsplit(urljoin(manifest_url, icon["src"])).path
            expected_prefix = mount + "frontend-zcl/"
            if not path.startswith(expected_prefix):
                errors.append("Manifest icon resolves outside frontend-zcl: " + icon["src"])
            elif not (assets / path[len(expected_prefix):]).is_file():
                errors.append("Missing manifest icon: " + icon["src"])
    if len(manifest.get("icons", [])) != 2:
        errors.append("Expected the generated 192px and 512px manifest icons")

    frontend_files = {root / "index.html"}
    for url in page.css:
        file = root / url.lstrip("/")
        if file.is_file():
            data = file.read_bytes()
            frontend_files.add(file)
            if b"data:font" in data or b"@font-face" in data:
                errors.append("Unexpected embedded/webfont payload in " + str(file.relative_to(root)))
    weight = sum(len(gzip.compress(file.read_bytes(), mtime=0)) for file in frontend_files)
    budget = 22 * 1024
    if weight > budget:
        errors.append(f"HTML + CSS gzip size {weight} exceeds {budget}-byte budget")

    for name in ("style.css", "zclassic.png", "zclassic.ico", "cc0.png", "LICENSE"):
        if not (root / name).is_file():
            errors.append("Missing compatibility/licence file: " + name)

    if args.base:
        def original(name):
            return subprocess.check_output(["git", "-C", str(root), "show", args.base + ":" + name])

        for name in ("style.css", "zclassic.png", "zclassic.ico", "cc0.png", "LICENSE", "CNAME",
                     "zclassic-mission-2025.pdf", "zclassic.pdf", "zclassic-whitepaper.pdf"):
            if not (root / name).is_file() or (root / name).read_bytes() != original(name):
                errors.append("Compatibility/licence file differs from upstream: " + name)
        upstream = original("index.html").decode()
        baseline = Page()
        baseline.feed(upstream)
        if page.downloads != baseline.downloads:
            errors.append("Release download URLs differ from upstream")
        if setup_commands(html) != setup_commands(upstream):
            errors.append("Z23 setup commands differ from upstream")
        # The share image is intentionally replaced; every other social tag must match upstream.
        for pattern in (r'<link rel="canonical"[^>]*>', r'<meta property="og:(?!image)[^>]*>'):
            if re.findall(pattern, html) != re.findall(pattern, upstream):
                errors.append("Canonical/social metadata differs from upstream")

    if errors:
        for error in errors:
            print("FAIL:", error, file=sys.stderr)
        return 1
    print(f"PASS: no JavaScript, assets, fragments, manifest at root/subpath, and {weight:,}-byte HTML+CSS gzip budget")
    if args.base:
        print("PASS: upstream compatibility assets, LICENSE, download URLs, Z23 commands, and sharing metadata")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
