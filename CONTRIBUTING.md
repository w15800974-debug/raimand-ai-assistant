# Contributing to Raimand (رایمند)

Thank you for your interest in contributing to **Raimand AI Assistant**! Whether you're fixing a bug, adding a new tool integration, improving RTL/Persian typography, or enhancing documentation, your contributions are welcome.

## Development Setup

1. **Fork & Clone** the repository:
   ```bash
   git clone https://github.com/w15800974-debug/raimand-ai-assistant.git
   cd raimand-ai-assistant
   ```
2. **Prerequisites**:
   - Node.js `>= 20.9`
   - PostgreSQL `>= 14`
3. **Install Dependencies**:
   ```bash
   npm install
   ```
4. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Update DATABASE_URL in .env if needed
   npx drizzle-kit push
   ```
5. **Run Development Server**:
   ```bash
   npm run dev
   ```

## Code Quality Checks

Before opening a Pull Request, please ensure all checks pass:

```bash
npm run lint
npm run typecheck
npm run build
```

## Pull Request Guidelines

- Keep PRs focused on a single feature, fix, or improvement.
- Describe the motivation and testing steps clearly in the PR description.
- Respect workspace sandboxing boundaries (`src/lib/paths.ts`) and approval policies (`src/lib/approvals.ts`) when adding new agent tools.
- Ensure any UI changes maintain clean Persian RTL layout and dark/light theme compatibility.
