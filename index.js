const Node = {
  process: process,
};

const { ValidName } = require("./utils");

function Attempt(instance, end) {
  const platform = Node.process.platform;
  if (platform === "darwin") {
    const { Mac } = require("./mac");
    return Mac(instance, end);
  }
  if (platform === "linux") {
    const { Linux } = require("./linux");
    return Linux(instance, end);
  }
  if (platform === "win32") {
    const { Windows } = require("./windows");
    return Windows(instance, end);
  }
  end(new Error("Platform not yet supported."));
}

function CheckInput(args) {
  var command = args[0];
  var options = {};
  var end = function () {};
  var platform = Node.process.platform;
  if (platform !== "darwin" && platform !== "linux" && platform !== "win32") {
    return end(new Error("Platform not yet supported."));
  }
  if (args.length < 1 || args.length > 3) {
    throw new Error("Wrong number of arguments.");
  }
  if (typeof command !== "string" && typeof command !== "object") {
    throw new Error("Command should be a string or an object.");
  }
  if (args.length === 2) {
    if (args[1] !== null && typeof args[1] === "object") {
      options = args[1];
    } else if (typeof args[1] === "function") {
      end = args[1];
    } else {
      throw new Error("Expected options or callback.");
    }
  } else if (args.length === 3) {
    if (args[1] !== null && typeof args[1] === "object") {
      options = args[1];
    } else {
      throw new Error("Expected options to be an object.");
    }
    if (typeof args[2] === "function") {
      end = args[2];
    } else {
      throw new Error("Expected callback to be a function.");
    }
  }
  if (/^sudo/i.test(command)) {
    return end(new Error('Command should not be prefixed with "sudo".'));
  }
  if (typeof options.name === "undefined") {
    var title = process.title;
    if (ValidName(title)) {
      options.name = title;
    } else {
      return end(new Error("process.title cannot be used as a valid name."));
    }
  } else if (!ValidName(options.name)) {
    var error = "";
    error += "options.name must be alphanumeric only ";
    error += "(spaces are allowed) and <= 70 characters.";
    return end(new Error(error));
  }
  if (typeof options.icns !== "undefined") {
    if (typeof options.icns !== "string") {
      return end(new Error("options.icns must be a string if provided."));
    } else if (options.icns.trim().length === 0) {
      return end(new Error("options.icns must not be empty if provided."));
    }
  }
  if (typeof options.env !== "undefined") {
    if (typeof options.env !== "object") {
      return end(new Error("options.env must be an object if provided."));
    } else if (Object.keys(options.env).length === 0) {
      return end(new Error("options.env must not be empty if provided."));
    } else {
      for (var key in options.env) {
        var value = options.env[key];
        if (typeof key !== "string" || typeof value !== "string") {
          return end(
            new Error("options.env environment variables must be strings."),
          );
        }
        // "Environment variable names used by the utilities in the Shell and
        // Utilities volume of IEEE Std 1003.1-2001 consist solely of uppercase
        // letters, digits, and the '_' (underscore) from the characters defined
        // in Portable Character Set and do not begin with a digit. Other
        // characters may be permitted by an implementation; applications shall
        // tolerate the presence of such names."
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
          return end(
            new Error(
              "options.env has an invalid environment variable name: " +
                JSON.stringify(key),
            ),
          );
        }
        if (/[\r\n]/.test(value)) {
          return end(
            new Error(
              "options.env has an invalid environment variable value: " +
                JSON.stringify(value),
            ),
          );
        }
      }
    }
  }

  return { command, options, end };
}

function Exec() {
  const sanitized = CheckInput(arguments);

  var instance = {
    command: sanitized.command,
    options: sanitized.options,
    type: "child",
    uuid: undefined,
    path: undefined,
  };
  Attempt(instance, sanitized.end);
}

function Spawn() {
  const sanitized = CheckInput(arguments);

  var instance = {
    command: sanitized.command,
    options: sanitized.options,
    type: "spawn",
    uuid: undefined,
    path: undefined,
  };
  Attempt(instance, sanitized.end);
}

module.exports = { exec: Exec, spawn: Spawn };
