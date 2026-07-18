"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");
const { download, extractVerifiedBinary, inspectArchive, validateUrl, verifyChecksum } = require("../scripts/install");

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rarcane-installer-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

async function server(t, handler) {
  const instance = http.createServer(handler);
  await new Promise((resolve) => instance.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    instance.closeAllConnections();
    instance.close();
  });
  return `http://127.0.0.1:${instance.address().port}`;
}

test("rejects insecure URLs by default", () => {
  assert.throws(() => validateUrl("http://example.test/archive"), /non-HTTPS/);
});

test("downloads through bounded relative redirects", async (t) => {
  const directory = temporaryDirectory(t);
  const destination = path.join(directory, "asset");
  const base = await server(t, (request, response) => {
    if (request.url === "/start") {
      response.writeHead(302, { location: "/asset" });
      response.end();
    } else {
      response.end("verified bytes");
    }
  });
  await download(`${base}/start`, destination, { allowInsecureHttp: true });
  assert.equal(fs.readFileSync(destination, "utf8"), "verified bytes");
});

test("fails closed on redirect loops and timeouts", async (t) => {
  const directory = temporaryDirectory(t);
  const looping = await server(t, (_request, response) => {
    response.writeHead(302, { location: "/again" });
    response.end();
  });
  await assert.rejects(download(looping, path.join(directory, "loop"), { allowInsecureHttp: true }), /too many redirects/);

  const stalled = await server(t, () => {});
  await assert.rejects(download(stalled, path.join(directory, "stall"), { allowInsecureHttp: true, timeoutMs: 30 }), /timed out/);
});

test("accepts a matching checksum and rejects tampering", (t) => {
  const directory = temporaryDirectory(t);
  const archive = path.join(directory, "rarcane-x86_64.tar.gz");
  const checksum = `${archive}.sha256`;
  fs.writeFileSync(archive, "release archive");
  const digest = crypto.createHash("sha256").update("release archive").digest("hex");
  fs.writeFileSync(checksum, `${digest}  ${path.basename(archive)}\n`);
  verifyChecksum(archive, checksum);
  fs.appendFileSync(archive, "tampered");
  assert.throws(() => verifyChecksum(archive, checksum), /verification failed/);
});

test("extracts only a single regular binary and rejects archive paths", (t) => {
  const directory = temporaryDirectory(t);
  const source = path.join(directory, "source");
  const output = path.join(directory, "output");
  fs.mkdirSync(path.join(source, "nested"), { recursive: true });
  fs.writeFileSync(path.join(source, "rarcane"), "binary");
  fs.writeFileSync(path.join(source, "nested", "rarcane"), "nested");

  const valid = path.join(directory, "valid.tar.gz");
  assert.equal(spawnSync("tar", ["-C", source, "-czf", valid, "rarcane"]).status, 0);
  assert.equal(fs.readFileSync(extractVerifiedBinary(valid, output, "rarcane"), "utf8"), "binary");

  const nested = path.join(directory, "nested.tar.gz");
  assert.equal(spawnSync("tar", ["-C", source, "-czf", nested, "nested/rarcane"]).status, 0);
  assert.throws(() => inspectArchive(nested, "rarcane"), /exactly rarcane/);
});

test("shell installer verifies checksum and rejects non-regular archives", (t) => {
  const directory = temporaryDirectory(t);
  const archive = path.join(directory, "rarcane-x86_64.tar.gz");
  const checksum = `${archive}.sha256`;
  fs.writeFileSync(path.join(directory, "rarcane"), "binary");
  assert.equal(spawnSync("tar", ["-C", directory, "-czf", archive, "rarcane"]).status, 0);
  const digest = crypto.createHash("sha256").update(fs.readFileSync(archive)).digest("hex");
  fs.writeFileSync(checksum, `${digest}  ${path.basename(archive)}\n`);
  const script = path.resolve(__dirname, "../../../scripts/install.sh");
  const command = `source "${script}"; verify_checksum "${archive}" "${checksum}"; extract_verified_binary "${archive}" "${directory}" rarcane`;
  const result = spawnSync("bash", ["-c", command], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("shell installer exits cleanly and removes its temporary directory", (t) => {
  const directory = temporaryDirectory(t);
  const fixtureDirectory = path.join(directory, "fixtures");
  const installDirectory = path.join(directory, "bin");
  const installerDirectory = path.join(directory, "installer-tmp");
  fs.mkdirSync(fixtureDirectory);
  fs.writeFileSync(path.join(fixtureDirectory, "rarcane"), "binary");

  const archive = path.join(fixtureDirectory, "rarcane-x86_64.tar.gz");
  const checksum = `${archive}.sha256`;
  assert.equal(spawnSync("tar", ["-C", fixtureDirectory, "-czf", archive, "rarcane"]).status, 0);
  const digest = crypto.createHash("sha256").update(fs.readFileSync(archive)).digest("hex");
  fs.writeFileSync(checksum, `${digest}  ${path.basename(archive)}\n`);

  const script = path.resolve(__dirname, "../../../scripts/install.sh");
  const command = `
    set -euo pipefail
    SCRIPT="$1"
    ARCHIVE="$2"
    CHECKSUM="$3"
    INSTALLER_DIR="$4"
    export INSTALL_DIR="$5"
    source "$SCRIPT"
    mktemp() { mkdir -p "$INSTALLER_DIR"; printf '%s\\n' "$INSTALLER_DIR"; }
    download_file() {
      if [[ "$1" == *.sha256 ]]; then cp "$CHECKSUM" "$2"; else cp "$ARCHIVE" "$2"; fi
    }
    main
  `;
  const result = spawnSync(
    "bash",
    ["-c", command, "installer-test", script, archive, checksum, installerDirectory, installDirectory],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(installDirectory, "rarcane"), "utf8"), "binary");
  assert.equal(fs.existsSync(installerDirectory), false, "EXIT trap should remove installer temp directory");
});
