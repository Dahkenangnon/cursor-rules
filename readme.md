# Cursor Rules

A collection of standardized rules for [Cursor](https://cursor.sh/) editor to enhance development workflows across different React Router projects.

## What are Cursor Rules?

Cursor Rules are documentation and code snippets that help the AI understand your codebase better. They provide context about your project structure, coding standards, and common patterns that should be followed.

The `always-follow.mdc` file contains project guidelines including:
- Tech stack details
- Project structure 
- Coding conventions
- Routes declaration
- Form handling patterns
- Mongoose models structure

## Installation

You can use this package directly from GitHub without installing it:

```bash
# Run directly using npx with GitHub repository
npx github:Dahkenangnon/cursor-rules pull
npx github:Dahkenangnon/cursor-rules push --token YOUR_GITHUB_TOKEN --new-branch my-update

# Or clone the repository for local development
git clone https://github.com/Dahkenangnon/cursor-rules.git
cd cursor-rules
npm install
npm link # For local development
```

## Synchronization Scripts

This repository includes two scripts to help you synchronize rules between your local project and this central repository:

### pull

Pulls the latest rules from the GitHub repository and merges them with your local rules.

```bash
# Run directly from GitHub (no token needed for public repos)
npx github:Dahkenangnon/cursor-rules pull

# Or if using a private repository
npx github:Dahkenangnon/cursor-rules pull --token YOUR_GITHUB_TOKEN --private

# If locally cloned and linked
pull
```

#### Options:

| Option | Description | Default |
|--------|-------------|---------|
| `-b, --branch <name>` | Branch to pull from | `main` |
| `-o, --owner <name>` | GitHub repository owner | `Dahkenangnon` |
| `-r, --repo <name>` | GitHub repository name | `cursor-rules` |
| `-p, --path <path>` | Path to rules in the repository | `rules/reactrouter/standard/always-follow.mdc` |
| `-d, --dest <path>` | Destination path for local rules | `.cursor/rules/always-follow.mdc` |
| `-t, --token <token>` | GitHub personal access token | `GITHUB_TOKEN` env var |
| `--private` | Indicate if the repository is private (requires token) | `false` |
| `--no-backup` | Skip creating a backup of the local file | - |
| `--merge-strategy <strategy>` | Merge strategy to use (simple, smart, manual) | `smart` |
| `--force` | Force overwrite local file without merging | `false` |
| `--verbose` | Enable verbose logging | `false` |

### push

Pushes your local rules to the GitHub repository as a pull request. **Requires GitHub token.**

```bash
# Run directly from GitHub (token is required)
npx github:Dahkenangnon/cursor-rules push --token YOUR_GITHUB_TOKEN --new-branch update-rules-20240607

# Or if locally cloned and linked
push --token YOUR_GITHUB_TOKEN --new-branch update-rules-20240607
```

#### Options:

| Option | Description | Default |
|--------|-------------|---------|
| `-b, --branch <name>` | Base branch to create PR against | `main` |
| `-o, --owner <name>` | GitHub repository owner | `Dahkenangnon` |
| `-r, --repo <name>` | GitHub repository name | `cursor-rules` |
| `-p, --path <path>` | Path to rules in the repository | `rules/reactrouter/standard/always-follow.mdc` |
| `-s, --source <path>` | Source path for local rules | `.cursor/rules/always-follow.mdc` |
| `-t, --token <token>` | GitHub personal access token (REQUIRED) | `GITHUB_TOKEN` env var |
| `-m, --message <message>` | Commit and PR message | `Update cursor rules` |
| `--no-pr` | Skip creating a pull request | - |
| `-n, --new-branch <name>` | Name for the new branch to create | **Required** |
| `--verbose` | Enable verbose logging | `false` |
| `--validate` | Validate content before pushing | `true` |

## Merge Strategies

When pulling rules, you can choose between different merge strategies:

- **simple**: Concatenates remote and local files with a separator
- **smart**: Uses three-way merge to intelligently combine changes
- **manual**: Provides an interactive interface to choose how to merge files

## Usage Examples

### Pulling the latest standard rules

```bash
# Basic usage (for public repositories)
npx github:Dahkenangnon/cursor-rules pull

# For private repositories, use a token
export GITHUB_TOKEN=your_token_here
npx github:Dahkenangnon/cursor-rules pull --private

# Or specify token directly
npx github:Dahkenangnon/cursor-rules pull --token your_token_here --private
```

### Using different merge strategies

```bash
# Use simple merge strategy (concatenation)
npx github:Dahkenangnon/cursor-rules pull --merge-strategy simple

# Use smart merge strategy (default)
npx github:Dahkenangnon/cursor-rules pull --merge-strategy smart

# Use manual merge with interactive prompts
npx github:Dahkenangnon/cursor-rules pull --merge-strategy manual
```

### Customizing the pull location

```bash
npx github:Dahkenangnon/cursor-rules pull --path rules/nextjs/standard/always-follow.mdc --dest .cursor/nextjs-rules.mdc
```

### Creating a pull request with your changes

```bash
# Create a PR with changes (token is required)
npx github:Dahkenangnon/cursor-rules push --token YOUR_GITHUB_TOKEN --new-branch update-june-2024 --message "Add new form handling patterns"

# Just push to a branch without creating a PR
npx github:Dahkenangnon/cursor-rules push --token YOUR_GITHUB_TOKEN --new-branch my-updates --no-pr

# Verbose mode for debugging
npx github:Dahkenangnon/cursor-rules push --token YOUR_GITHUB_TOKEN --new-branch my-updates --verbose
```

## Rules Directory Structure

```
rules/
├── reactrouter/          # React Router rules
│   ├── standard/         # Standard rules for React Router
│   │   └── always-follow.mdc
│   └── advanced/         # Advanced patterns
├── nextjs/              # Next.js specific rules
└── express/             # Express.js specific rules
```

## Contributing

1. Fork the repository
2. Create a new branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Submit a pull request

Please ensure your rules follow the established patterns and include clear documentation.

## Requirements

- Node.js >= 14.0.0
- GitHub personal access token with repo scope (for push and private repos)

## License

MIT
