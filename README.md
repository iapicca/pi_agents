# Pi Planning Workflow

> **⚠️ Work in Progress** — This project is not yet finished.

A strict, planning-only workflow for [Pi](https://pi.dev) that uses three agents: **RESEARCHER → PLANNER → ORGANIZER**. See [ARCHITECTURE.md](./ARCHITECTURE.md) for details.

## Installation

### Prerequisites

- Node.js & npm
- GitHub CLI (`gh`) — install via `brew install gh` or [github.com/cli/cli](https://github.com/cli/cli)

### Setup

1. **Install Pi:**
   ```bash
   npm install -g @mariozechner/pi-coding-agent
   ```

2. **Configure Pi API key:**
   ```bash
   # Set your OpenCode API key in the environment
   export OPCODE_API_KEY="your-api-key-here"

   # Create the auth config file
   echo '{ "opencode-go": { "type": "api_key", "key": "'"$OPCODE_API_KEY"'" } }' > ~/.pi/agent/auth.json
   ```

3. **Clone this repo and enter the directory:**
   ```bash
   git clone https://github.com/iapicca/pi_agents.git
   cd pi_agents
   ```

4. **Authenticate with GitHub:**
   ```bash
   gh auth login
   ```

5. **Start Pi:**
   ```bash
   pi
   ```

## Usage

```
/plan "Add OAuth authentication with GitHub"
```

After PLAN.md is generated, review it and approve:

```
/approve_plan approved=true
```

Or request changes:

```
/approve_plan approved=false feedback="Add more detail about error handling"
```

See [AGENTS.md](./AGENTS.md) for all commands.

## License

MIT
