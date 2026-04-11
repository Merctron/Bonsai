#!/usr/bin/env node

import { Command } from 'commander';
import { showDiffDump, launchTUI } from './index.js';
import { spawn } from 'child_process';
import { colors } from './colors.js';

const program = new Command();

program
  .name('bonsai')
  .description('A beautiful, opinionated git diff viewer for code review')
  .version('0.1.0')
  .argument('[range]', 'Commit range to diff (e.g., HEAD~3 or HEAD~5..HEAD~2)', 'HEAD~1')
  .option('--dump', 'Output static diff and exit (for piping/scripts)')
  .action(async (range, options) => {
    try {
      // Dump mode (static output)
      if (options.dump) {
        // Check if output is a TTY (terminal)
        if (process.stdout.isTTY) {
          // Pipe to less with colors and vim keybindings
          const less = spawn('less', [
            '-R',        // Raw color codes
            '-S',        // Chop long lines (no wrapping)
          ], {
            stdio: ['pipe', process.stdout, process.stderr]
          });

          // Redirect our output to less
          const originalWrite = process.stdout.write.bind(process.stdout);
          const originalError = process.stderr.write.bind(process.stderr);

          process.stdout.write = (chunk, encoding, callback) => {
            return less.stdin.write(chunk, encoding, callback);
          };

          // Handle less errors gracefully
          less.on('error', (err) => {
            process.stdout.write = originalWrite;
            process.stderr.write = originalError;
            console.error(`Failed to spawn less: ${err.message}`);
            process.exit(1);
          });

          // Show the diff
          try {
            await showDiffDump(range);
          } catch (error) {
            // Restore stdout/stderr before displaying error
            process.stdout.write = originalWrite;
            process.stderr.write = originalError;
            less.stdin.end();
            less.kill();
            throw error;
          }

          // Close less stdin to trigger display
          less.stdin.end();

          // Wait for less to finish and restore stdout
          await new Promise((resolve) => {
            less.on('close', () => {
              process.stdout.write = originalWrite;
              process.stderr.write = originalError;
              resolve();
            });
          });
        } else {
          // Not a TTY (piped output), just print directly
          await showDiffDump(range);
        }
      } else {
        // TUI mode (default, interactive)
        await launchTUI(range);
      }
    } catch (error) {
      // Display error message
      console.error(colors.removed(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program.parse();
