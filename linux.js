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
  USER_PROMPT_TIMEOUT,
  OPERATOR,
  DELAY,
  LIMIT,
  MAGIC,
} = require("./constants");

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

  var instanceCmd = `/bin/bash -c "echo ${EscapeDoubleQuotes(MAGIC.trim())}; `;

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

  var instanceCmd = `echo ${EscapeDoubleQuotes(MAGIC.trim())}; `;
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
      var elevated = stdout && stdout.slice(0, MAGIC.length) === MAGIC;
      if (elevated) stdout = stdout.slice(MAGIC.length);
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

function SetStdioOption(stdio) {
  //stdio options: stdin, stdout, and stderr
  // gotta set it pipe to get the prompt... sorry.
  // gotta get the error output, sorry.
  if (typeof stdio === "string") {
    return [stdio, "pipe", "pipe"];
  }
  if (typeof stdio === "object") {
    return [stdio[0], "pipe", "pipe"];
  }
}

function Spawn(instance, binary, end) {
  // https://nodejs.org/api/child_process.html#optionsdetached
  var command = PrepareSpawnCommand(instance, binary);
  var spawnOptions = undefined;
  var stdioOptions = undefined;
  var keepOpen = true; // keep the stdout open for data stream
  var detached = false;
  var elevated = false;
  var hasError = false;
  if (typeof instance.options.spawn !== "undefined") {
    spawnOptions = instance.options.spawn;
    if (typeof instance.options.spawn.detached !== "undefined") {
      detached = instance.options.spawn.detached;
    }
    if (typeof instance.options.spawn.stdio !== "undefined") {
      stdioOptions = SetStdioOption(instance.options.spawn.stdio);
    }
    if (typeof instance.options.spawn.keepOpen !== "undefined") {
      keepOpen = instance.options.spawn.keepOpen;
    }
  }

  const spawnRun = Node.child.spawn(command.cmd, command.args, spawnOptions);

  spawnRun.stdout.on("data", (res) => {
    var response = res.toString();
    if (response.slice(0, MAGIC.length) === MAGIC) {
      elevated = true;
      response = response.slice(MAGIC.length);
    }

    if ((elevated && !detached) || (elevated && keepOpen)) {
      end(null, response, null);
    }
  });

  spawnRun.stderr.on("data", (err) => {
    hasError = true;
    var error = err.toString();
    var message = "";
    //assuming that elevation did not happen...
    if (/No authentication agent found/.test(error)) {
      message = NO_POLKIT_AGENT;
    } else {
      message = PERMISSION_DENIED;
    }
    end(new Error(message));
  });

  if (detached) {
    let i = 1;
    let timerId = setTimeout(function request() {
      //check if error, or user just simply cancels prompt.
      if (!hasError) {
        //check elevated
        if (!elevated) {
          // rerun the countdown until user gets elevated or timeout occurs.
          i++;
          // Check the limiter
          if (i >= LIMIT) {
            clearTimeout(timerId);
            spawnRun.kill();
            end(new Error(USER_PROMPT_TIMEOUT));
          } else {
            timerId = setTimeout(request, DELAY);
          }
        } else {
          clearTimeout(timerId);
          spawnRun.stdout.end();
          spawnRun.stderr.end();
          spawnRun.unref();
          end(null, `Spawned child pid: ${spawnRun.pid}`, null);
        }
      }
    }, DELAY);
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
