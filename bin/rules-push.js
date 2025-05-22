#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { program } = require('commander');
const { Octokit } = require('@octokit/rest');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const semver = require('semver');

// Version check
const packageJson = require('../package.json');
if (semver.lt(process.version, packageJson.engines.node)) {
  console.error(chalk.red(`You are using Node ${process.version}, but this tool requires Node ${packageJson.engines.node} or higher.`));
  process.exit(1);
}

program
  .name('push')
  .description('Push local cursor rules to GitHub repository as a pull request')
  .option('-b, --branch <name>', 'Base branch to create PR against', 'main')
  .option('-o, --owner <name>', 'GitHub repository owner', 'Dahkenangnon')
  .option('-r, --repo <name>', 'GitHub repository name', 'cursor-rules')
  .option('-p, --path <path>', 'Path to rules in the repository', 'rules/reactrouter/standard/always-follow.mdc')
  .option('-s, --source <path>', 'Source path for local rules', '.cursor/rules/always-follow.mdc')
  .option('-t, --token <token>', 'GitHub personal access token (REQUIRED, can also be set as GITHUB_TOKEN env variable)')
  .option('-m, --message <message>', 'Commit and PR message', 'Update cursor rules')
  .option('--no-pr', 'Skip creating a pull request (just push to a new branch)')
  .option('--verbose', 'Enable verbose logging', false)
  .option('--validate', 'Validate content before pushing', true)
  .requiredOption('-n, --new-branch <name>', 'Name for the new branch to create')
  .version(packageJson.version)
  .parse(process.argv);

const options = program.opts();

// Get GitHub token from options or environment variable
const token = options.token || process.env.GITHUB_TOKEN;

if (!token) {
  console.error(chalk.red('GitHub token is required for pushing changes. Provide it with --token or set GITHUB_TOKEN environment variable.'));
  process.exit(1);
}

// Create spinner
const spinner = ora('Starting rules push process').start();

// Check if source file exists
if (!fs.existsSync(options.source)) {
  spinner.fail(chalk.red(`Source file not found: ${options.source}`));
  process.exit(1);
}

// Validate source file content if enabled
if (options.validate) {
  spinner.text = 'Validating source file content';
  try {
    const content = fs.readFileSync(options.source, 'utf8');
    
    // Basic validation - check if file is not empty
    if (!content.trim()) {
      spinner.fail(chalk.red('Source file is empty.'));
      process.exit(1);
    }
    
    // Check if content looks like a Cursor rules file (basic heuristic)
    if (!content.includes('# ') && !content.includes('## ')) {
      spinner.warn(chalk.yellow('Source file might not be a valid Cursor rules file. It lacks markdown headings.'));
      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'Do you want to proceed anyway?',
        default: false
      }]);
      
      if (!proceed) {
        spinner.fail(chalk.red('Push cancelled by user.'));
        process.exit(1);
      }
      spinner.start('Continuing with push...');
    }
  } catch (error) {
    spinner.fail(chalk.red(`Error validating source file: ${error.message}`));
    process.exit(1);
  }
}

// Create temp directory
const tempDir = path.join(process.cwd(), '.cursor-rules-temp');
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });

async function main() {
  try {
    spinner.text = 'Cloning repository...';
    execSync(
      `git clone https://x-access-token:${token}@github.com/${options.owner}/${options.repo}.git ${tempDir}`,
      { stdio: options.verbose ? 'inherit' : 'pipe' }
    );

    spinner.text = `Checking out branch: ${options.branch}`;
    execSync(`cd ${tempDir} && git checkout ${options.branch}`, { 
      stdio: options.verbose ? 'inherit' : 'pipe' 
    });

    spinner.text = `Creating new branch: ${options.newBranch}`;
    execSync(`cd ${tempDir} && git checkout -b ${options.newBranch}`, { 
      stdio: options.verbose ? 'inherit' : 'pipe' 
    });

    // Ensure directory exists in the repository
    const repoFilePath = path.join(tempDir, options.path);
    const repoFileDir = path.dirname(repoFilePath);
    if (!fs.existsSync(repoFileDir)) {
      fs.mkdirSync(repoFileDir, { recursive: true });
      spinner.info(chalk.blue(`Created directory in repo: ${options.path.split('/').slice(0, -1).join('/')}`));
      spinner.start('Continuing...');
    }

    // Check if the file already exists in the repo and if it's different
    let fileModified = true;
    if (fs.existsSync(repoFilePath)) {
      const repoContent = fs.readFileSync(repoFilePath, 'utf8');
      const localContent = fs.readFileSync(options.source, 'utf8');
      
      if (repoContent === localContent) {
        fileModified = false;
        spinner.info(chalk.blue('File content is identical to the remote version.'));
        
        const { forceCommit } = await inquirer.prompt([{
          type: 'confirm',
          name: 'forceCommit',
          message: 'File is unchanged. Do you want to create a commit anyway?',
          default: false
        }]);
        
        if (!forceCommit) {
          spinner.succeed(chalk.green('No changes to commit. Process completed.'));
          cleanup();
          return;
        }
        spinner.start('Continuing with push...');
      }
    }

    // Copy local file to repo
    fs.copyFileSync(options.source, repoFilePath);
    spinner.succeed(chalk.green(`Copied local rules to repo: ${options.path}`));
    spinner.start('Setting up git config...');

    // Commit and push changes
    execSync(`cd ${tempDir} && git config user.name "Cursor Rules Updater"`, { 
      stdio: options.verbose ? 'inherit' : 'pipe' 
    });
    execSync(`cd ${tempDir} && git config user.email "noreply@cursor-rules-updater.com"`, { 
      stdio: options.verbose ? 'inherit' : 'pipe' 
    });
    execSync(`cd ${tempDir} && git add "${options.path}"`, { 
      stdio: options.verbose ? 'inherit' : 'pipe' 
    });
    
    try {
      execSync(`cd ${tempDir} && git commit -m "${options.message}"`, { 
        stdio: options.verbose ? 'inherit' : 'pipe' 
      });
      
      spinner.text = 'Pushing changes...';
      execSync(`cd ${tempDir} && git push -u origin ${options.newBranch}`, { 
        stdio: options.verbose ? 'inherit' : 'pipe' 
      });
      
      // Create pull request if enabled
      if (options.pr) {
        spinner.text = 'Creating pull request...';
        const octokit = new Octokit({ auth: token });
        
        const prResponse = await octokit.pulls.create({
          owner: options.owner,
          repo: options.repo,
          title: options.message,
          head: options.newBranch,
          base: options.branch,
          body: `This PR updates cursor rules from local project.

## Changes
- Updated rules in \`${options.path}\`
${fileModified ? '' : '- No content changes, but commit requested by user'}

Automatically generated by the cursor-rules push script.`
        });
        
        spinner.succeed(chalk.green(`Successfully created pull request: ${prResponse.data.html_url}`));
      } else {
        spinner.succeed(chalk.green(`Successfully pushed to branch: ${options.newBranch}`));
      }
    } catch (error) {
      if (error.message.includes('nothing to commit')) {
        spinner.info(chalk.blue('No changes to commit.'));
      } else {
        throw error;
      }
    }
  } catch (error) {
    spinner.fail(chalk.red(`Error pushing rules: ${error.message}`));
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

// Run the main function
main().catch(error => {
  spinner.fail(chalk.red(`Unexpected error: ${error.message}`));
  if (options.verbose) {
    console.error(error);
  }
  cleanup();
  process.exit(1);
});
