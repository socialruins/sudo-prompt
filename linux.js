const Node = {
  child: require("child_process"),
  crypto: require("crypto"),
  fs: require("fs"),
  os: require("os"),
  path: require("path"),
  process: process,
  util: require("util"),
};

const { EscapeDoubleQuotes } = require("./utils");
const {
  MAX_BUFFER,
  PERMISSION_DENIED,
  NO_POLKIT_AGENT,
  OPERATOR,
} = require("./constants");

const magic = "SUDOPROMPT\n";

function PrepareExecCommand(instance, binary) {
  var command = [];
  var operator = OPERATOR;
  if (typeof instance.options.operator !== "undefined") {
    operator = instance.options.operator;
  }
  // Preserve current working directory:
  command.push('cd "' + EscapeDoubleQuotes(Node.process.cwd()) + '";');
  // Export environment variables:
  for (var key in instance.options.env) {
    var value = instance.options.env[key];
    command.push("export " + key + '="' + EscapeDoubleQuotes(value) + '";');
  }
  command.push('"' + EscapeDoubleQuotes(binary) + '"');
  if (/kdesudo/i.test(binary)) {
    command.push(
      "--comment",
      '"' +
        instance.options.name +
        " wants to make changes. " +
        'Enter your password to allow this."',
    );
    command.push("-d"); // Do not show the command to be run in the dialog.
    command.push("--");
  } else if (/pkexec/i.test(binary)) {
    command.push("--disable-internal-agent");
  }

  var instanceCmd = `/bin/bash -c "echo ${EscapeDoubleQuotes(magic.trim())}; `;

  if (typeof instance.command === "string") {
    instanceCmd += EscapeDoubleQuotes(instance.command);
  } else if (typeof instance.command === "object") {
    var arrayCommands = [];
    for (var key in instance.command) {
      var value = instance.command[key];
      arrayCommands.push(`${EscapeDoubleQuotes(value)}`);
    }

    instanceCmd += arrayCommands.join(` ${operator} `);
  }

  instanceCmd += `"`;
  command.push(instanceCmd);
  command = command.join(" ");
  return command;
}

function PrepareSpawnCommand(instance, binary) {
  var args = [];
  var operator = OPERATOR;
  if (typeof instance.options.operator !== "undefined") {
    operator = instance.options.operator;
  }
  var command = EscapeDoubleQuotes(binary);
  if (/kdesudo/i.test(binary)) {
    args.push(
      "--comment",
      '"' +
        instance.options.name +
        " wants to make changes. " +
        'Enter your password to allow this."',
    );
    args.push("-d"); // Do not show the command to be run in the dialog.
    args.push("--");
  } else if (/pkexec/i.test(binary)) {
    args.push("--disable-internal-agent");
  }

  args.push("/bin/bash");
  args.push("-c");

  var instanceCmd = `echo ${EscapeDoubleQuotes(magic.trim())}; `;
  if (typeof instance.command === "string") {
    instanceCmd += EscapeDoubleQuotes(instance.command);
  } else if (typeof instance.command === "object") {
    var arrayCommands = [];
    for (var key in instance.command) {
      var value = instance.command[key];
      arrayCommands.push(EscapeDoubleQuotes(value));
    }

    instanceCmd += arrayCommands.join(` ${operator} `); // need those spaces...
  }

  args.push(instanceCmd);

  return {
    cmd: command,
    args: args,
  };
}

function Execution(instance, binary, end) {
  var command = PrepareExecCommand(instance, binary);
  Node.child.exec(
    command,
    { encoding: "utf-8", maxBuffer: MAX_BUFFER },
    function (error, stdout, stderr) {
      // ISSUE 88:
      // We must distinguish between elevation errors and command errors.
      //
      // KDESUDO:
      // kdesudo provides no way to do this. We add a magic marker to know
      // if elevation succeeded. Any error thereafter is a command error.
      //
      // PKEXEC:
      // "Upon successful completion, the return value is the return value of
      // PROGRAM. If the calling process is not authorized or an
      // authorization could not be obtained through authentication or an
      // error occured, pkexec exits with a return value of 127. If the
      // authorization could not be obtained because the user dismissed the
      // authentication dialog, pkexec exits with a return value of 126."
      //
      // However, we do not rely on pkexec's return of 127 since our magic
      // marker is more reliable, and we already use it for kdesudo.
      var elevated = stdout && stdout.slice(0, magic.length) === magic;
      if (elevated) stdout = stdout.slice(magic.length);
      // Only normalize the error if it is definitely not a command error:
      // In other words, if we know that the command was never elevated.
      // We do not inspect error messages beyond NO_POLKIT_AGENT.
      // We cannot rely on English errors because of internationalization.
      if (error && !elevated) {
        if (/No authentication agent found/.test(stderr)) {
          error.message = NO_POLKIT_AGENT;
        } else {
          error.message = PERMISSION_DENIED;
        }
      }
      end(error, stdout, stderr);
    },
  );
}

function Spawn(instance, binary, end) {
  var command = PrepareSpawnCommand(instance, binary);
  var spawnOptions = undefined;
  var detached = false;
  if (typeof instance.options.spawn !== "undefined") {
    spawnOptions = instance.options.spawn;
    if (typeof instance.options.spawn.detached !== "undefined") {
      detached = instance.options.spawn.detached;
    }
  }

  const spawnRun = Node.child.spawn(command.cmd, command.args, spawnOptions);

  var stdout;
  var elevated =
    spawnRun.stdout &&
    spawnRun.stdout.toString().slice(0, magic.length) === magic;
  if (elevated) stdout = spawnRun.stdout.toString().slice(magic.length);

  spawnRun.on("error", (error) => {
    if (!elevated) {
      if (/No authentication agent found/.test(spawnRun.stderr)) {
        error.message = NO_POLKIT_AGENT;
      } else {
        error.message = PERMISSION_DENIED;
      }
    }
    end(error, stdout, spawnRun.stderr);
  });

  if (detached) {
    var pid = spawnRun.pid;
    spawnRun.on("close", (code) => {
      if (code !== 0) {
        end(
          new Error(`Spawn process exited with code ${code}`),
          stdout,
          spawnRun.stderr,
        );
      }
    });

    spawnRun.unref();
    end(`Spawned process ${pid}`);
  } else {
    spawnRun.stdout.on("data", (data) => {
      end(data.toString());
    });

    spawnRun.stderr.on("data", (data) => {
      end(data.toString());
    });

    spawnRun.on("close", (code) => {
      if (code !== 0) {
        end(`Spawn process exited with code ${code}`);
      }
    });
  }
}

function Linux(instance, end) {
  LinuxBinary(function (error, binary) {
    if (error) return end(error);

    if (typeof instance.type !== "undefined") {
      if (instance.type === "child") {
        Execution(instance, binary, end);
      }
      if (instance.type === "spawn") {
        Spawn(instance, binary, end);
      }
    } else {
      Execution(instance, binary, end);
    }
  });
}

function LinuxBinary(end) {
  var index = 0;
  // We used to prefer gksudo over pkexec since it enabled a better prompt.
  // However, gksudo cannot run multiple commands concurrently.
  var paths = ["/usr/bin/kdesudo", "/usr/bin/pkexec"];
  function test() {
    if (index === paths.length) {
      return end(new Error("Unable to find pkexec or kdesudo."));
    }
    var path = paths[index++];
    Node.fs.stat(path, function (error) {
      if (error) {
        if (error.code === "ENOTDIR") return test();
        if (error.code === "ENOENT") return test();
        end(error);
      } else {
        end(undefined, path);
      }
    });
  }
  test();
}

module.exports.Linux = Linux;
