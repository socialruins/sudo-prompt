const Node = {
  child: require("child_process"),
  crypto: require("crypto"),
  path: require("path"),
  process: process,
};

const Remove = (path, end) => {
  if (typeof path !== "string" || !path.trim()) {
    return end(new Error("Argument path not defined."));
  }
  var command = [];
  if (Node.process.platform === "win32") {
    if (/"/.test(path)) {
      return end(new Error("Argument path cannot contain double-quotes."));
    }
    command.push('rmdir /s /q "' + path + '"');
  } else {
    command.push("/bin/rm");
    command.push("-rf");
    command.push('"' + EscapeDoubleQuotes(Node.path.normalize(path)) + '"');
  }
  command = command.join(" ");
  Node.child.exec(command, { encoding: "utf-8" }, end);
};

const UUID = (instance, end) => {
  Node.crypto.randomBytes(256, function (error, random) {
    if (error) random = Date.now() + "" + Math.random();
    var hash = Node.crypto.createHash("SHA256");
    hash.update("sudo-prompt-3");
    hash.update(instance.options.name);
    hash.update(instance.command);
    hash.update(random);
    var uuid = hash.digest("hex").slice(-32);
    if (!uuid || typeof uuid !== "string" || uuid.length !== 32) {
      // This is critical to ensure we don't remove the wrong temp directory.
      return end(new Error("Expected a valid UUID."));
    }
    end(undefined, uuid);
  });
};

const ValidName = (string) => {
  // We use 70 characters as a limit to side-step any issues with Unicode
  // normalization form causing a 255 character string to exceed the fs limit.
  if (!/^[a-z0-9 ]+$/i.test(string)) return false;
  if (string.trim().length === 0) return false;
  if (string.length > 70) return false;
  return true;
};

const EscapeDoubleQuotes = (string) => {
  if (typeof string !== "string") throw new Error("Expected a string.");
  return string.replace(/"/g, '\\"');
};

module.exports = {
  Remove,
  UUID,
  ValidName,
  EscapeDoubleQuotes,
};
