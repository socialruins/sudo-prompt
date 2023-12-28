var assert = require("assert");
var fs = require("fs");
var sudo = require("./");
var exec = require("child_process").exec;

function kill(end) {
  if (process.platform === "win32") return end();
  exec("sudo -k", end);
}

function icns() {
  if (process.platform !== "darwin") return undefined;
  var path = "/Applications/Electron.app/Contents/Resources/Electron.icns";
  try {
    fs.statSync(path);
    return path;
  } catch (error) {}
  return undefined;
}

kill(function () {
  const out = fs.openSync("./out.log", "a");
  const err = fs.openSync("./out.log", "a");
  var options = {
    env: { SUDO_PROMPT_TEST_ENV: "hello world" },
    icns: icns(),
    name: "Electron",
    spawn: undefined,
  };

  var command = "echo test";

  sudo.spawn(command, options, function (response) {
    console.log("response:", response);
  });
});
