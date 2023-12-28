export function exec(
  cmd: string,
  options?:
    | ((
        error?: Error,
        stdout?: string | Buffer,
        stderr?: string | Buffer,
      ) => void)
    | { name?: string; icns?: string; env?: { [key: string]: string } },
  callback?: (
    error?: Error,
    stdout?: string | Buffer,
    stderr?: string | Buffer,
  ) => void,
): void;
export function spawn(
  cmd: string,
  options?:
    | ((
        error?: Error,
        stdout?: string | Buffer,
        stderr?: string | Buffer,
      ) => void)
    | {
        name?: string;
        icns?: string;
        env?: { [key: string]: string };
        spawn?: { [key: string]: any };
      },
  callback?: (
    error?: Error,
    stdout?: string | Buffer,
    stderr?: string | Buffer,
  ) => void,
): void;
