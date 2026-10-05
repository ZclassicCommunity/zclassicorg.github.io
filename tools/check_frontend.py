#!/usr/bin/env python3
"""Check static assets, manifest paths, weight, and optional upstream parity.

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
        self.scripts = []
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
        if tag == "script" and attrs.get("src") and urlsplit(attrs["src"]).netloc:
            self.errors.append("Third-party runtime script: " + attrs["src"])
        elif tag == "script" and attrs.get("src"):
            self.scripts.append(attrs["src"])


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
    script_text = ""
    for url in page.css:
        file = root / url.lstrip("/")
        if file.is_file():
            data = file.read_bytes()
            frontend_files.add(file)
            if b"data:font" in data or b"@font-face" in data:
                errors.append("Unexpected embedded/webfont payload in " + str(file.relative_to(root)))
    for url in page.scripts:
        file = root / url.lstrip("/")
        if file.is_file():
            frontend_files.add(file)
            script_text += file.read_text() + "\n"
    weight = sum(len(gzip.compress(file.read_bytes(), mtime=0)) for file in frontend_files)
    budget = 22 * 1024
    if weight > budget:
        errors.append(f"HTML + CSS + JavaScript gzip size {weight} exceeds {budget}-byte budget")

    if (root / "REVIEW_REPORT.md").exists():
        errors.append("Review reports do not belong in the published website")

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
        release = re.search(r"const releaseBase\s*=\s*'([^']+)';", html + script_text)
        if release:
            page.downloads.update(release[1] + f for f in re.findall(r"file:\s*'([^']+)'", html + script_text))
        if page.downloads != baseline.downloads:
            errors.append("Release download URLs differ from upstream")
        if setup_commands(html) != setup_commands(upstream):
            errors.append("Z23 setup commands differ from upstream")
        for pattern in (r'<link rel="canonical"[^>]*>', r'<meta property="og:[^>]*>'):
            if re.findall(pattern, html) != re.findall(pattern, upstream):
                errors.append("Canonical/social metadata differs from upstream")

    if errors:
        for error in errors:
            print("FAIL:", error, file=sys.stderr)
        return 1
    print(f"PASS: assets, fragments, manifest at root/subpath, and {weight:,}-byte HTML+CSS+JS gzip budget")
    if args.base:
        print("PASS: upstream compatibility assets, LICENSE, download URLs, Z23 commands, and sharing metadata")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
