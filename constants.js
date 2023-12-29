const PERMISSION_DENIED = "User did not grant permission.";
const NO_POLKIT_AGENT = "No polkit authentication agent found.";
const USER_PROMPT_TIMEOUT = "User prompt timed out.";

// See issue 66:
const MAX_BUFFER = 134217728;

// Use ; No matter the first command cmd1 run successfully or not, always run the second command cmd2.
// Use && Only when the first command cmd1 run successfully, run the second command cmd2.
// Use || Only when the first command cmd1 failed to run, run the second command cmd2.
const OPERATOR = ";";

const MAGIC = "SUDOPROMPT\n";

const DELAY = 250; //ms for prompt timeout
const LIMIT = 200; //iterations of DELAY

module.exports = {
  PERMISSION_DENIED,
  NO_POLKIT_AGENT,
  USER_PROMPT_TIMEOUT,
  MAX_BUFFER,
  OPERATOR,
  DELAY,
  LIMIT,
  MAGIC,
};
