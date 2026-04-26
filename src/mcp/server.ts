/**
 * MCP server for usetapeui.
 *
 * Exposes a directory of .tape.json files as MCP tools so any
 * MCP-capable agent (Claude Code, Cursor, etc.) can read sessions natively.
 *
 * Tools:
 *   tape_list_sessions       — list all .tape files in the watched dir
 *   tape_get_session         — fetch a single session by filename
 *   tape_get_latest_critique — get the most recent session as agent format
 *   tape_get_critique        — get a specific session as a chosen format
 *   tape_summary             — high-level stats about the most recent session
 *
 * The server is dependency-loaded lazily so users who never run `usetapeui`
 * via CLI don't pay for the MCP SDK at install time.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  exportAgent,
  exportJson,
  exportMarkdown,
  exportPrompt,
} from '../core/exporters';
import { parseTape } from '../core/persist';
import type { CritiqueReport, TapeFile } from '../types';

interface SessionInfo {
  file: string;
  path: string;
  mtime: number;
  size: number;
  url: string;
  recordedAt: number;
  duration: number;
  commentCount: number;
  markerCount: number;
}

function listSessions(dir: string): SessionInfo[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir);
  const sessions: SessionInfo[] = [];
  for (const file of entries) {
    if (!file.endsWith('.tape.json') && !file.endsWith('.tape')) continue;
    const fp = path.join(dir, file);
    try {
      const stat = fs.statSync(fp);
      const text = fs.readFileSync(fp, 'utf8');
      const report = parseTape(text);
      if (!report) continue;
      sessions.push({
        file,
        path: fp,
        mtime: stat.mtimeMs,
        size: stat.size,
        url: report.url,
        recordedAt: report.recordedAt,
        duration: report.duration,
        commentCount: report.comments.length,
        markerCount: report.markers.length,
      });
    } catch {
      // skip unreadable files
    }
  }
  sessions.sort((a, b) => b.mtime - a.mtime);
  return sessions;
}

function loadSession(dir: string, file: string): CritiqueReport | null {
  const fp = path.join(dir, file);
  if (!fs.existsSync(fp)) return null;
  try {
    const text = fs.readFileSync(fp, 'utf8');
    return parseTape(text);
  } catch {
    return null;
  }
}

/** Build and run the MCP server against a tapes directory. */
export async function runServer(tapesDir: string): Promise<void> {
  // Lazy import the MCP SDK so it remains an optional peer.
  let serverMod: any;
  let stdioMod: any;
  let typesMod: any;
  try {
    serverMod = await import('@modelcontextprotocol/sdk/server/index.js');
    stdioMod = await import('@modelcontextprotocol/sdk/server/stdio.js');
    typesMod = await import('@modelcontextprotocol/sdk/types.js');
  } catch (err) {
    console.error('[usetapeui mcp] @modelcontextprotocol/sdk is not installed.');
    console.error('Install it with:  npm install @modelcontextprotocol/sdk');
    process.exit(2);
  }

  const Server = serverMod.Server;
  const StdioServerTransport = stdioMod.StdioServerTransport;
  const ListToolsRequestSchema = typesMod.ListToolsRequestSchema;
  const CallToolRequestSchema = typesMod.CallToolRequestSchema;

  const server = new Server(
    { name: 'usetapeui', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  const TOOLS = [
    {
      name: 'tape_list_sessions',
      description:
        'List all recorded TAPE sessions in the watched directory, newest first. Returns file name, recording URL, recorded-at timestamp, duration, and comment count.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'tape_get_latest_critique',
      description:
        'Return the most recent TAPE session as the structured <design_critique> agent format. Use this to pull the latest review into your context.',
      inputSchema: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['agent', 'prompt', 'markdown', 'json'],
            description: 'Output format. Default: agent.',
          },
        },
      },
    },
    {
      name: 'tape_get_critique',
      description: 'Return a specific TAPE session by file name in a chosen format.',
      inputSchema: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'File name (e.g. "tape-2026-04-26.tape.json").' },
          format: {
            type: 'string',
            enum: ['agent', 'prompt', 'markdown', 'json'],
          },
        },
        required: ['file'],
      },
    },
    {
      name: 'tape_get_session',
      description: 'Return the full raw CritiqueReport JSON for a session.',
      inputSchema: {
        type: 'object',
        properties: {
          file: { type: 'string' },
        },
        required: ['file'],
      },
    },
    {
      name: 'tape_summary',
      description:
        'High-level stats on the most recent session: counts by sentiment, list of changed files (from source links), and top 5 issues.',
      inputSchema: { type: 'object', properties: {} },
    },
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req: any) => {
    const name = req.params.name as string;
    const args = (req.params.arguments || {}) as Record<string, any>;

    try {
      switch (name) {
        case 'tape_list_sessions': {
          const sessions = listSessions(tapesDir);
          return {
            content: [{ type: 'text', text: JSON.stringify(sessions, null, 2) }],
          };
        }

        case 'tape_get_latest_critique': {
          const sessions = listSessions(tapesDir);
          if (sessions.length === 0) {
            return { content: [{ type: 'text', text: 'No sessions found in ' + tapesDir }] };
          }
          const latest = sessions[0];
          const report = loadSession(tapesDir, latest.file);
          if (!report) {
            return { content: [{ type: 'text', text: 'Failed to parse latest session.' }] };
          }
          const fmt = (args.format as string) || 'agent';
          return { content: [{ type: 'text', text: formatReport(report, fmt) }] };
        }

        case 'tape_get_critique': {
          const file = String(args.file || '');
          const report = loadSession(tapesDir, file);
          if (!report) {
            return { content: [{ type: 'text', text: 'Session not found: ' + file }] };
          }
          const fmt = (args.format as string) || 'agent';
          return { content: [{ type: 'text', text: formatReport(report, fmt) }] };
        }

        case 'tape_get_session': {
          const file = String(args.file || '');
          const report = loadSession(tapesDir, file);
          if (!report) {
            return { content: [{ type: 'text', text: 'Session not found: ' + file }] };
          }
          return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
        }

        case 'tape_summary': {
          const sessions = listSessions(tapesDir);
          if (sessions.length === 0) {
            return { content: [{ type: 'text', text: 'No sessions found.' }] };
          }
          const report = loadSession(tapesDir, sessions[0].file);
          if (!report) {
            return { content: [{ type: 'text', text: 'Failed to parse latest session.' }] };
          }
          return { content: [{ type: 'text', text: buildSummary(report) }] };
        }

        default:
          return {
            content: [{ type: 'text', text: 'Unknown tool: ' + name }],
            isError: true,
          };
      }
    } catch (err) {
      return {
        content: [{ type: 'text', text: 'Error: ' + (err as Error).message }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // The server runs until stdin closes.
  process.stderr.write(`[usetapeui mcp] watching ${tapesDir}\n`);
}

function formatReport(report: CritiqueReport, fmt: string): string {
  switch (fmt) {
    case 'json':
      return exportJson(report);
    case 'markdown':
      return exportMarkdown(report);
    case 'prompt':
      return exportPrompt(report);
    case 'agent':
    default:
      return exportAgent(report);
  }
}

function buildSummary(report: CritiqueReport): string {
  const counts: Record<string, number> = { issue: 0, positive: 0, question: 0, note: 0 };
  for (const c of report.comments) counts[c.sentiment] = (counts[c.sentiment] || 0) + 1;
  const files = new Set<string>();
  for (const c of report.comments) {
    const f = c.marker?.source?.fileName;
    if (f) files.add(f);
  }
  const issues = report.comments.filter((c) => c.sentiment === 'issue').slice(0, 5);
  const lines: string[] = [];
  lines.push(`Session: ${report.url}`);
  lines.push(`Recorded: ${new Date(report.recordedAt).toISOString()}`);
  lines.push(`Duration: ${Math.round(report.duration / 1000)}s`);
  lines.push(`Comments: ${report.comments.length} (issue ${counts.issue}, positive ${counts.positive}, question ${counts.question}, note ${counts.note})`);
  if (files.size > 0) {
    lines.push(`Files involved: ${Array.from(files).join(', ')}`);
  }
  if (issues.length > 0) {
    lines.push('');
    lines.push('Top issues:');
    issues.forEach((c, i) => {
      lines.push(`  ${i + 1}. ${c.marker?.selector || '(general)'} — ${c.text || '(silent)'}`);
    });
  }
  return lines.join('\n');
}

/** Helper exposed for tests: get session info without running the server. */
export function debugListSessions(dir: string): SessionInfo[] {
  return listSessions(dir);
}
