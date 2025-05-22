#!/usr/bin/env node

/**
 * Main entry point for cursor-rules
 * This helps with direct npx execution
 */

const { execSync } = require('node:child_process');
const path = require('node:path');

// Get the command argument (pull or push)
const args = process.argv.slice(2);
const command = args[0];
const remainingArgs = args.slice(1);

// Map of valid commands to their script paths
const commands = {
  'pull': './bin/rules-pull.js',
  'push': './bin/rules-push.js'
};

// Check if the command is valid
if (!command || !commands[command]) {
  console.error(`
Usage: npx cursor-rules <command> [options]

Commands:
  pull    Pull rules from GitHub repository
  push    Push rules to GitHub repository

Example:
  npx cursor-rules pull
  npx cursor-rules push --token YOUR_GITHUB_TOKEN --new-branch my-update
`);
  process.exit(1);
}

// Execute the appropriate script
try {
  const scriptPath = path.join(__dirname, commands[command]);
  process.argv = [process.argv[0], scriptPath, ...remainingArgs];
  require(scriptPath);
} catch (error) {
  console.error(`Error executing command: ${error.message}`);
  process.exit(1);
} 