/**
 * usetapeui CLI.
 *
 * Usage:
 *   usetapeui mcp [--dir <path>]    Start an MCP server reading sessions from <path>.
 *   usetapeui list [--dir <path>]   List sessions in <path>.
 *   usetapeui --help                Show help.
 *   usetapeui --version             Print version.
 *
 * Default directory is $TAPE_DIR or ./tapes.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { runServer, debugListSessions } from './server';

const VERSION = '1.0.0';

function parseArgs(argv: string[]): { command: string; dir: string; help: boolean; version: boolean } {
  const args = argv.slice(2);
  let command = '';
  let dir = process.env.TAPE_DIR || path.resolve(process.cwd(), 'tapes');
  let help = false;
  let version = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--help' || a === '-h') help = true;
    else if (a === '--version' || a === '-v') version = true;
    else if (a === '--dir' || a === '-d') {
      dir = path.resolve(args[++i] || dir);
    } else if (!command) {
      command = a;
    }
  }

  return { command, dir, help, version };
}

function printHelp(): void {
  console.log(`usetapeui v${VERSION}

Usage:
  usetapeui mcp  [--dir <path>]   Start an MCP server reading .tape.json files from <path>.
  usetapeui list [--dir <path>]   List recorded sessions in <path>.
  usetapeui --version             Print version.
  usetapeui --help                This message.

Defaults:
  <path> is $TAPE_DIR if set, otherwise ./tapes.

To use the MCP server with an agent, point it at the binary, e.g.

  Claude Code: add to your MCP config
    "usetapeui": { "command": "npx", "args": ["usetapeui", "mcp", "--dir", "./tapes"] }

  Cursor: configure as a stdio MCP server pointing to the same command.
`);
}

async function main(): Promise<void> {
  const { command, dir, help, version } = parseArgs(process.argv);
  if (version) {
    console.log(VERSION);
    return;
  }
  if (help || !command) {
    printHelp();
    return;
  }

  switch (command) {
    case 'mcp': {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
          process.stderr.write(`[usetapeui] created tapes directory: ${dir}\n`);
        } catch (err) {
          console.error(`[usetapeui] failed to create directory ${dir}: ${(err as Error).message}`);
          process.exit(1);
        }
      }
      await runServer(dir);
      return;
    }

    case 'list': {
      const sessions = debugListSessions(dir);
      if (sessions.length === 0) {
        console.log(`No sessions found in ${dir}`);
        return;
      }
      for (const s of sessions) {
        const date = new Date(s.recordedAt).toISOString();
        console.log(`${date}  ${s.commentCount.toString().padStart(3, ' ')} comments  ${s.url}`);
        console.log(`  ${s.file}`);
      }
      return;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
