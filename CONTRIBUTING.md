# Contributing Guidelines

Thank you for your interest in contributing to GitHub Commits Leaderboard.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Set up the development environment (see README.md)
4. Create a new branch for your changes

## Development Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Run database migrations
node scripts/migrate.mjs

# Start development server
npm run dev
```

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/add-user-search` - New features
- `fix/leaderboard-pagination` - Bug fixes
- `docs/api-examples` - Documentation updates
- `refactor/db-queries` - Code refactoring

### Commit Messages

Write clear, concise commit messages:

- Use the imperative mood ("Add feature" not "Added feature")
- Keep the first line under 72 characters
- Reference issues when applicable ("Fix #123: Resolve pagination bug")

### Code Style

- Follow the existing code style
- Run `npm run lint` before committing
- Run `npm run typecheck` to ensure type safety
- Format code with Prettier (configured in the project)

### Testing

- Test your changes locally before submitting
- Ensure the build passes: `npm run build`
- Test with the local development server

## Pull Requests

### Before Submitting

1. Update documentation if needed
2. Add or update tests if applicable
3. Ensure all checks pass
4. Rebase on the latest main branch

### PR Description

Include in your pull request:

- A clear description of the changes
- The motivation for the changes
- Any breaking changes
- Screenshots for UI changes

### Review Process

- PRs require at least one approval before merging
- Address review feedback promptly
- Keep PRs focused and reasonably sized

## Types of Contributions

### Bug Reports

- Use the GitHub issue tracker
- Include steps to reproduce
- Include expected vs actual behavior
- Include environment details

### Feature Requests

- Open an issue to discuss before implementing
- Explain the use case and benefits
- Consider backwards compatibility

### Documentation

- Fix typos and improve clarity
- Add examples and explanations
- Keep documentation up to date with code changes

### Code Contributions

- Bug fixes
- Performance improvements
- New features (discuss first)
- Refactoring (with clear benefits)

## What We Cannot Accept

- Changes that compromise user privacy
- Features that enable abuse or gaming of the leaderboard
- Dependencies with incompatible licenses
- Code without proper error handling

## Questions

If you have questions about contributing, open a discussion on GitHub or reach out to the maintainers.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
