#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const diff = require('diff');
const threeWayMerge = require('three-way-merge');

// Version check
const semver = require('semver');
const packageJson = require('../package.json');
if (semver.lt(process.version, packageJson.engines.node)) {
  console.error(chalk.red(`You are using Node ${process.version}, but this tool requires Node ${packageJson.engines.node} or higher.`));
  process.exit(1);
}

program
  .name('pull')
  .description('Pull cursor rules from GitHub repository and merge with local rules')
  .option('-b, --branch <name>', 'Branch to pull from', 'main')
  .option('-o, --owner <name>', 'GitHub repository owner', 'Dahkenangnon')
  .option('-r, --repo <name>', 'GitHub repository name', 'cursor-rules')
  .option('-p, --path <path>', 'Path to rules in the repository', 'rules/reactrouter/standard/always-follow.mdc')
  .option('-d, --dest <path>', 'Destination path for local rules', '.cursor/rules/always-follow.mdc')
  .option('-t, --token <token>', 'GitHub personal access token (can also be set as GITHUB_TOKEN env variable, required only for private repos)')
  .option('--no-backup', 'Skip creating a backup of the local file')
  .option('--merge-strategy <strategy>', 'Merge strategy to use (simple, smart, manual)', 'smart')
  .option('--force', 'Force overwrite local file without merging', false)
  .option('--verbose', 'Enable verbose logging', false)
  .option('--private', 'Indicate if the repository is private (requires token)', false)
  .version(packageJson.version)
  .parse(process.argv);

const options = program.opts();

// Get GitHub token from options or environment variable
const token = options.token || process.env.GITHUB_TOKEN;

// Only require token for private repos
if (options.private && !token) {
  console.error(chalk.red('GitHub token is required for private repositories. Provide it with --token or set GITHUB_TOKEN environment variable.'));
  process.exit(1);
}

// Validate options
if (!['simple', 'smart', 'manual'].includes(options.mergeStrategy)) {
  console.error(chalk.red(`Invalid merge strategy: ${options.mergeStrategy}. Use 'simple', 'smart', or 'manual'.`));
  process.exit(1);
}

// Create temp directory
const tempDir = path.join(process.cwd(), '.cursor-rules-temp');
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });

// Create spinner
const spinner = ora('Starting rules pull process').start();

async function main() {
  try {
    spinner.text = 'Cloning repository...';
    
    // Use different clone command based on whether token is provided
    const cloneUrl = token 
      ? `https://x-access-token:${token}@github.com/${options.owner}/${options.repo}.git`
      : `https://github.com/${options.owner}/${options.repo}.git`;
    
    execSync(
      `git clone ${cloneUrl} ${tempDir}`,
      { stdio: options.verbose ? 'inherit' : 'pipe' }
    );

    spinner.text = `Checking out branch: ${options.branch}`;
    execSync(`cd ${tempDir} && git checkout ${options.branch}`, { 
      stdio: options.verbose ? 'inherit' : 'pipe' 
    });

    // Read remote rules file
    const remoteFilePath = path.join(tempDir, options.path);
    if (!fs.existsSync(remoteFilePath)) {
      spinner.fail(chalk.red(`Remote rules file not found: ${options.path}`));
      process.exit(1);
    }

    spinner.text = 'Reading remote content';
    const remoteContent = fs.readFileSync(remoteFilePath, 'utf8');
    
    // Create destination directory if it doesn't exist
    const destDir = path.dirname(options.dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
      spinner.info(chalk.blue(`Created directory: ${destDir}`));
      spinner.start('Continuing...');
    }

    // Check if local file exists
    const localFileExists = fs.existsSync(options.dest);
    let localContent = '';
    let originalContent = '';

    // Backup local file if it exists and backup is enabled
    if (localFileExists) {
      localContent = fs.readFileSync(options.dest, 'utf8');
      originalContent = localContent; // Save for three-way merge
      
      if (options.backup) {
        const backupPath = `${options.dest}.backup.${Date.now()}`;
        fs.copyFileSync(options.dest, backupPath);
        spinner.info(chalk.blue(`Created backup at: ${backupPath}`));
        spinner.start('Continuing...');
      }
    }

    // Handle different scenarios based on existence of local file and options
    if (!localFileExists || options.force) {
      // Case 1: No local file or force overwrite
      fs.writeFileSync(options.dest, remoteContent, 'utf8');
      spinner.succeed(chalk.green(`${localFileExists ? 'Overwrote' : 'Created new'} local rules file at: ${options.dest}`));
    } else {
      // Compare files
      if (localContent === remoteContent) {
        spinner.succeed(chalk.green('Local file is already up to date. No changes needed.'));
        cleanup();
        return;
      }

      // Case 2: Merge based on strategy
      spinner.text = `Merging files using ${options.mergeStrategy} strategy`;
      
      let mergedContent;
      
      switch (options.mergeStrategy) {
        case 'simple':
          // Simple concatenation with separator
          mergedContent = `${remoteContent}\n\n# Local additions below\n# ========================================\n\n${localContent}`;
          fs.writeFileSync(options.dest, mergedContent, 'utf8');
          spinner.succeed(chalk.green(`Merged remote rules with local rules at: ${options.dest} (simple strategy)`));
          break;
          
        case 'smart':
          try {
            // Use smart merging from the three-way-merge package
            // For this to work optimally, we need a common ancestor, but we'll use an empty string as fallback
            const commonAncestor = ''; // Ideally, this would be the last synced version
            const { result, conflict } = threeWayMerge(commonAncestor, remoteContent, localContent);
            
            if (conflict) {
              spinner.warn(chalk.yellow('Conflicts detected during smart merge.'));
              // Create conflict markers similar to git
              const conflictContent = generateConflictMarkers(remoteContent, localContent);
              fs.writeFileSync(options.dest, conflictContent, 'utf8');
              spinner.info(chalk.blue(`Wrote file with conflict markers at: ${options.dest}`));
              spinner.info(chalk.blue('Please resolve conflicts manually and then commit.'));
            } else {
              fs.writeFileSync(options.dest, result, 'utf8');
              spinner.succeed(chalk.green(`Successfully merged files at: ${options.dest} (smart strategy)`));
            }
          } catch (error) {
            spinner.warn(chalk.yellow(`Smart merge failed: ${error.message}. Falling back to manual merge.`));
            // Fall through to manual merge
            options.mergeStrategy = 'manual';
          }
          
          if (options.mergeStrategy === 'manual') {
            // Generate diff and ask user how to proceed
            spinner.stop();
            const patches = diff.createPatch('rules', localContent, remoteContent);
            console.log(chalk.cyan('\nDifferences between local and remote:'));
            console.log(patches);
            
            const { action } = await inquirer.prompt([{
              type: 'list',
              name: 'action',
              message: 'How would you like to proceed?',
              choices: [
                { name: 'Keep remote version (overwrite local)', value: 'remote' },
                { name: 'Keep local version (discard remote)', value: 'local' },
                { name: 'Concatenate (remote + local)', value: 'concat' },
                { name: 'Edit manually (opens in default editor)', value: 'manual' }
              ]
            }]);
            
            spinner.start('Processing your selection');
            
            switch (action) {
              case 'remote':
                fs.writeFileSync(options.dest, remoteContent, 'utf8');
                spinner.succeed(chalk.green('Kept remote version (overwrote local).'));
                break;
              case 'local':
                // Do nothing, keep local
                spinner.succeed(chalk.green('Kept local version (discarded remote).'));
                break;
              case 'concat':
                const concatContent = `${remoteContent}\n\n# Local additions below\n# ========================================\n\n${localContent}`;
                fs.writeFileSync(options.dest, concatContent, 'utf8');
                spinner.succeed(chalk.green('Concatenated remote and local versions.'));
                break;
              case 'manual':
                // Write a temporary file with both versions
                const tempFilePath = path.join(tempDir, 'manual_merge.mdc');
                const manualMergeContent = generateManualMergeFile(remoteContent, localContent);
                fs.writeFileSync(tempFilePath, manualMergeContent, 'utf8');
                
                spinner.info(chalk.blue(`Opening editor for manual merge. Please save and close when done.`));
                spinner.stop();
                
                try {
                  // Open in default editor based on platform
                  const editorCmd = process.platform === 'win32' ? 'notepad' : 
                                   process.platform === 'darwin' ? 'open -e' : 'xdg-open';
                  execSync(`${editorCmd} "${tempFilePath}"`, { stdio: 'inherit' });
                  
                  // Wait for user to finish editing
                  spinner.start('Waiting for manual edit to complete...');
                  const { confirmed } = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'confirmed',
                    message: 'Have you finished editing the file?',
                    default: true
                  }]);
                  
                  if (confirmed) {
                    const editedContent = fs.readFileSync(tempFilePath, 'utf8');
                    fs.writeFileSync(options.dest, editedContent, 'utf8');
                    spinner.succeed(chalk.green('Manual merge completed.'));
                  } else {
                    spinner.fail(chalk.red('Manual merge cancelled.'));
                  }
                } catch (error) {
                  spinner.fail(chalk.red(`Error opening editor: ${error.message}`));
                }
                break;
            }
          }
          break;
          
        case 'manual':
          // This case is handled within the smart merge fallback above
          break;
      }
    }

    spinner.succeed(chalk.green('Successfully pulled rules from GitHub'));
  } catch (error) {
    spinner.fail(chalk.red(`Error pulling rules: ${error.message}`));
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  } finally {
    cleanup();
  }
}

function cleanup() {
  // Clean up
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function generateConflictMarkers(remoteContent, localContent) {
  return `<<<<<<< REMOTE
${remoteContent}
=======
${localContent}
>>>>>>> LOCAL
`;
}

function generateManualMergeFile(remoteContent, localContent) {
  return `# MANUAL MERGE REQUIRED
# ===================================================
# Instructions:
# 1. Below you'll find both the remote and local versions
# 2. Edit this file to create the merged version you want
# 3. Save and close when you're done
# ===================================================

# REMOTE VERSION
# ===================================================
${remoteContent}

# LOCAL VERSION
# ===================================================
${localContent}

# YOUR MERGED VERSION BELOW (edit as needed)
# ===================================================

`;
}

// Run the main function
main().catch(error => {
  spinner.fail(chalk.red(`Unexpected error: ${error.message}`));
  if (options.verbose) {
    console.error(error);
  }
  cleanup();
  process.exit(1);
});
