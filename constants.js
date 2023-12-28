const PERMISSION_DENIED = "User did not grant permission.";
const NO_POLKIT_AGENT = "No polkit authentication agent found.";

// See issue 66:
const MAX_BUFFER = 134217728;

// Use ; No matter the first command cmd1 run successfully or not, always run the second command cmd2.
// Use && Only when the first command cmd1 run successfully, run the second command cmd2.
// Use || Only when the first command cmd1 failed to run, run the second command cmd2.
const OPERATOR = ";";

module.exports = {
  PERMISSION_DENIED,
  NO_POLKIT_AGENT,
  MAX_BUFFER,
  OPERATOR,
};
