import type { OS } from "@/context/OSContext";

/**
 * Lesson content lives here. Edit freely.
 */

export type LessonKind = "pre-work" | "lesson";
export type LessonIcon = "download" | "book" | "puzzle" | "plug" | "wrench" | "sparkles";
export type LessonBody = string | Partial<Record<OS, string>>;

export interface Lesson {
  slug: string;
  kind: LessonKind;
  number: number | null;
  icon: LessonIcon;
  title: string;
  summary: string;
  body: LessonBody;
}

export const TOTAL_LESSONS = 12;

export const lessons: Lesson[] = [
  {
    slug: "getting-ready",
    kind: "pre-work",
    number: null,
    icon: "download",
    title: "Getting Ready",
    summary: "Set up your terminal, install the Claude desktop app, and learn the shortcuts you'll lean on every day.",
    body: {
      mac: `# Getting Ready

Welcome to the incubator! Before we start "vibe coding," we need to get your environment ready. Claude Code is an agentic tool—meaning it doesn't just suggest text; it actually looks at your files, runs terminal commands, and helps build your project from the inside out.

On macOS, things are pretty straightforward. Let’s get you set up.

## System Requirements

To keep things smooth, make sure your Mac is running **macOS 13.0 (Ventura)** or newer. You’ll also want at least **4GB of RAM** and a stable internet connection so Claude can talk to its brain at Anthropic.

## Essential Documentation

Before you dive deep, it’s helpful to know where the map is. You can find the full index of Claude Code documentation here:
[https://code.claude.com/docs/llms.txt](https://code.claude.com/docs/llms.txt)

This text file is a great way to see every available topic at a glance.

## Installing Claude Code

You have two main ways to get up and running on a Mac: the native script or Homebrew.

### Option 1: Native Installation (Recommended)
This is the easiest method for most people. It installs the tool and handles background updates automatically so you’re always on the latest version. Open your Terminal (or iTerm2) and run:

\`\`\`bash
curl -fsSL https://claude.ai/install.sh | bash
\`\`\`

### Option 2: Homebrew
If you prefer managing your tools with Homebrew, you can install the cask. Keep in mind that Homebrew installations **do not** auto-update, so you’ll need to run an upgrade command manually to get new features.

To install:
\`\`\`bash
brew install --cask claude-code
\`\`\`

To update later:
\`\`\`bash
brew upgrade claude-code
\`\`\`

## The Desktop App
If you’re not quite ready to live in the terminal 24/7, Anthropic offers a native macOS desktop app. It provides a friendly interface for those who want the agent's power without typing every single command. You can grab the DMG directly from [claude.ai/download](https://claude.ai/download).

## Your First Launch

Once the installation finishes, navigate to any coding project you're working on and simply type:

\`\`\`bash
claude
\`\`\`

The first time you run this, you'll be prompted to log in and authorize the tool. After that, Claude is ready to help you build.

## Keyboard Shortcuts & Tips
*   **Searching:** Claude uses a tool called \`ripgrep\` to find code. Usually, this is bundled in, but if searching feels broken, check the [troubleshooting docs](https://code.claude.com/docs/troubleshooting).
*   **Shells:** Whether you use the default **Zsh** or prefer **Bash**, Claude Code works natively with both on macOS.
*   **Permissions:** Since Claude Code can run commands and edit files, it’ll ask for permission before doing anything big. Just keep an eye on your terminal for those "vibe checks."`,
      windows: `# Getting Ready

Before we start "vibe coding," we need to get your Windows environment set up. Claude Code is an agentic tool, which is a fancy way of saying it doesn't just chat—it actually rolls up its sleeves, reads your files, and runs commands to help you build.

First things first: if you want to see everything Claude Code can do, you can grab the full documentation index at \`https://code.claude.com/docs/llms.txt\`. It’s a great map to keep handy as you explore.

## Choosing Your Windows Path

On Windows, you have two main ways to work. Choose the one that matches where your code lives:

*   **Native Windows:** Best if you build Windows-specific apps. We highly recommend installing **Git for Windows** first. This gives Claude a Bash environment to work in, which makes it much more capable.
*   **WSL2 (Ubuntu):** Best if you prefer a Linux-like workflow or need to run your code in a sandboxed environment. You'll install everything inside your WSL terminal.

## Installing Claude Code

You can use the desktop app if you prefer a standard window, but the real power happens in the terminal. Here is how to get it running on your machine.

### Using PowerShell (Native)
If you see \`PS C:\\\` in your terminal, you’re in PowerShell. Run this command:

\`\`\`powershell
irm https://claude.ai/install.ps1 | iex
\`\`\`

### Using WSL2 or Git Bash
If you are inside Ubuntu on Windows or using a Bash-style terminal, use the Linux-ready script:

\`\`\`bash
curl -fsSL https://claude.ai/install.sh | bash
\`\`\`

### Using WinGet
If you're a fan of Windows Package Manager, this is a clean way to keep things organized:

\`\`\`powershell
winget install Anthropic.ClaudeCode
\`\`\`

**Note:** Native installs (PowerShell/Bash) handle their own updates in the background. If you use WinGet, you'll need to run \`winget upgrade Anthropic.ClaudeCode\` every now and then to get the latest goodies.

## The Desktop App
If you'd rather stay out of the terminal for now, you can download the standalone Windows app directly from \`claude.com/download\`. It’s a great way to get a feel for the agent without worrying about shell syntax.

## Launching Your First Session
Once the installation finishes, navigate to your project folder in your terminal of choice and simply type:

\`\`\`bash
claude
\`\`\`

## Daily Shortcuts
To move fast, keep these mental notes nearby:
*   **The Command:** Just type \`claude\` to start the agent in any folder.
*   **The Difference:** If a command starts with \`irm\`, use PowerShell. If it starts with \`curl\`, it’s usually for WSL or Bash.
*   **The Fix:** If Claude can’t find your tools on Native Windows, make sure **Git for Windows** is installed so it has a "brain" (Bash) to use for executing tasks.`,
      linux: `# Getting Ready

So, you’re ready to dive into Vibe Coding? Before we can start building, we need to get your toolkit ready. Think of Claude Code as a smart pair-programmer that lives in your terminal. It doesn't just chat; it reads your code, runs commands, and actually helps you ship features.

For this course, we’re focusing on a Linux environment (specifically Debian or Ubuntu). If you're running another flavor of Linux, most of these steps will still feel very familiar.

## System Check

Before we fire off any commands, let’s make sure your machine is up to the task. You’ll need:
*   **Operating System:** Ubuntu 20.04+ or Debian 10+.
*   **Memory:** At least 4GB of RAM.
*   **Hardware:** An x64 or ARM64 processor.
*   **Shell:** Bash or Zsh are the gold standards here.

Claude also needs an active internet connection to communicate with the mothership, so make sure you aren't stuck behind a heavy firewall.

## Installing Claude Code

The easiest way to get Claude on your Linux machine is via a simple terminal command. Open your preferred terminal and run this:

\`\`\`bash
curl -fsSL https://claude.ai/install.sh | bash
\`\`\`

This script handles the heavy lifting, and the best part is that native installs like this will automatically keep themselves updated in the background. You won't have to worry about manual patches every time a new version drops.

### Using Package Managers
If you prefer to manage things through \`apt\`, you can certainly do that. While the \`curl\` method is the most direct, many Linux users prefer knowing everything is tucked away in their system's package manager. Keep an eye on the official repo lists if you want to go the \`apt-get install\` route.

### The Desktop Alternative
If you aren't quite ready to live entirely in the terminal, there is a Desktop app available. It provides a more visual way to interact with the agent, though for the "Vibe Coding" experience, we highly recommend getting comfortable with the terminal version.

## Fire It Up

Once the installation finishes, navigate to any project folder you’re working on and simply type:

\`\`\`bash
claude
\`\`\`

The first time you run this, you'll likely need to log in to your Anthropic account to link everything up.

## Helpful Shortcuts and Resources

While you're getting settled, keep these resources in your back pocket:

*   **Documentation Index:** For a full map of every feature available, check out the raw documentation list at \`https://code.claude.com/docs/llms.txt\`. It’s a great way to see what else Claude is capable of.
*   **Troubleshooting:** If the built-in search feels a bit sluggish, make sure you have \`ripgrep\` installed. On Ubuntu/Debian, a quick \`sudo apt install ripgrep\` usually fixes any discovery issues.

In the next lesson, we’ll take our first "ride" and see how Claude actually interacts with your files!`,
    },
  },
  {
    slug: "installing-claude-code",
    kind: "lesson",
    number: 1,
    icon: "download",
    title: "Installing Claude Code",
    summary: "Get the Claude Code CLI installed and sign in so you're ready for Lesson 2.",
    body: {
      mac: `# Installing Claude Code

Ready to get Claude living in your terminal? For this course, we're focusing on macOS. We’ll use the command line to get everything set up so you can start "vibe coding" in no time.

## What You’ll Need

Before we dive in, make sure your Mac is ready:
* **OS**: macOS 13.0 (Ventura) or newer.
* **Memory**: At least 4 GB of RAM.
* **Tools**: You should have the **Terminal** app (or iTerm2) open and **Homebrew** installed.

## Installation Methods

There are two main ways to install the Claude Code CLI on a Mac. Pick the one that fits your workflow.

### Option 1: The Fast Way (Recommended)
This is a simple one-liner that downloads and runs the official installer. It’s great because it sets up background updates automatically, so you’re always using the latest version of Claude.

Run this in your terminal:
\`\`\`bash
curl -fsSL https://claude.ai/install.sh | bash
\`\`\`

### Option 2: Using Homebrew
If you prefer managing your tools via Homebrew, you can install Claude Code as a "cask." Note that this version won't auto-update, so you'll need to manually run \`brew upgrade\` when a new version drops.

To install the stable version:
\`\`\`bash
brew install --cask claude-code
\`\`\`

## Launching and Logging In

Once the installation command finishes, you’re ready to roll. 

1. **Open your project**: Navigate to the folder of the project you want to work on.
2. **Start Claude**: Type the following command and hit Enter:
   \`\`\`bash
   claude
   \`\`\`
3. **Sign In**: The first time you run this, Claude will prompt you to authenticate. Follow the instructions in your terminal to log in with your Anthropic account.

### Troubleshooting Tip
If for some reason Claude has trouble searching your files later on, it might be missing a helper tool called \`ripgrep\`. Usually, this installs automatically, but if search feels broken, you can grab it manually via Homebrew: \`brew install rg\`.

In the next lesson, we'll take Claude for a spin and see what it can actually do!`,
      windows: `# Installing Claude Code

Getting Claude Code onto your machine is the first step toward a smoother development workflow. Since you're on Windows, you have two main paths: running it natively on Windows or using the Windows Subsystem for Linux (WSL). Don't worry about picking the "wrong" one—they both work great, but they feel a little different.

## Choose Your Environment

Before we run any commands, decide where you want to work:

*   **Native Windows:** Choose this if you want to use standard Windows tools and file paths. I highly recommend installing [Git for Windows](https://git-scm.com/downloads/win) first. Even if you use PowerShell, Claude Code loves having Git Bash available in the background to handle commands.
*   **WSL2 (Ubuntu):** Choose this if you prefer a Linux-like flow or your project already relies on a Linux toolchain. It’s essentially running Linux inside Windows, and it offers great performance for web development.

## Step 1: Run the Installer

Open your preferred terminal—either **PowerShell** (for Native) or your **Ubuntu terminal** (for WSL)—and paste the appropriate command below.

### For Native PowerShell
If you see \`PS C:\\\` at the start of your line, run this:
\`\`\`powershell
irm https://claude.ai/install.ps1 | iex
\`\`\`

### For WSL2 (Ubuntu)
If you are inside your Linux distribution, use this command:
\`\`\`bash
curl -fsSL https://claude.ai/install.sh | bash
\`\`\`

### For WinGet (Alternative Native)
If you’re a fan of Windows Package Manager, this also works in PowerShell:
\`\`\`powershell
winget install Anthropic.ClaudeCode
\`\`\`

## Step 2: Launch and Authenticate

Once the installation bar finishes, you’re ready to go. Navigate to the folder where you keep your code projects.

To start the app, simply type:
\`\`\`bash
claude
\`\`\`

The first time you run this, Claude will ask you to sign in. It will provide a link and a temporary code. Follow the prompts in your browser to authorize your terminal. Once you're back in the terminal, you're officially connected!

## Troubleshooting Tips

*   **Command not found:** If \`claude\` doesn't work right away, try closing your terminal window and opening a fresh one to refresh your system's memory.
*   **PowerShell vs. CMD:** If you accidentally use Command Prompt (CMD) instead of PowerShell, the \`irm\` command will fail. Look for the \`PS\` prefix to be sure you're in PowerShell.
*   **Updates:** If you used the standard installers (the \`curl\` or \`irm\` scripts), Claude Code will automatically update itself in the background. If you used WinGet, you'll want to manually run \`winget upgrade Anthropic.ClaudeCode\` every once in a while to get the latest features.`,
      linux: `# Installing Claude Code

Welcome to the family! Before we can start "vibe coding," we need to get Claude Code living comfortably on your Linux machine. Since we're working with a Debian or Ubuntu environment, this process is straightforward. We’ll use the terminal to get everything wired up.

## System Requirements

Claude Code is pretty lightweight, but let’s make sure your rig is ready:

*   **OS**: Ubuntu 20.04+ or Debian 10+.
*   **Memory**: At least 4GB of RAM.
*   **Shell**: Bash or Zsh handles this best.
*   **Internet**: You’ll need a stable connection to talk to the AI.

## The One-Liner Install

For most Linux users, the easiest way to install is via a simple terminal script. This method is great because it handles background updates automatically, so you’re always using the latest version without thinking about it.

Open your favorite terminal and paste this in:

\`\`\`bash
curl -fsSL https://claude.ai/install.sh | bash
\`\`\`

### Alternative: Using the Package Manager

If you prefer to manage your software through \`apt\` (the standard Debian/Ubuntu way), you can do that too. While the curl script is faster, using \`apt\` keeps Claude Code in sync with your other system packages. 

## Initializing and Logging In

Once the installation finishes, you need to introduce yourself to Claude. Change directories into a project you’re working on and fire it up:

\`\`\`bash
claude
\`\`\`

The first time you run this, it will prompt you to authenticate. It usually involves a quick trip to your web browser to sign in to your Anthropic account. Once you see the successful login message in your terminal, you’re officially ready to roll.

## A Quick Troubleshooting Tip

Claude Code relies on a tool called \`ripgrep\` to search through your files quickly. On Ubuntu or Debian, it’s usually bundled in, but if Claude complains about not being able to "see" your code during a search, you can manually grab it using:

\`\`\`bash
sudo apt update && sudo apt install ripgrep
\`\`\`

That’s it! You’ve got the engine under the hood. In the next lesson, we’ll take it for a spin and see what this tool can actually do for your workflow.`,
    },
  },
  {
    slug: "claude-md-playbook",
    kind: "lesson",
    number: 2,
    icon: "book",
    title: "The CLAUDE.md Playbook",
    summary: "Give Claude persistent project memory so you stop repeating yourself every session.",
    body: `# The CLAUDE.md Playbook

Starting a new session with an AI can feel like Groundhog Day. You find yourself explaining the same folder structure, the same linting rules, and the same "don't use that library" warnings over and over. In the Vibe Coding world, we want to skip the chores and get straight to the building.

Claude Code uses two main features to remember how you work: **CLAUDE.md files** and **Auto Memory**.

## The Two Layers of Memory

Think of these like a handbook and a notebook.

*   **CLAUDE.md (The Handbook):** This is where *you* write the rules. It contains the fixed truths about your project: how to run tests, naming conventions, and architectural choices.
*   **Auto Memory (The Notebook):** This is where *Claude* jots things down. If you correct it or mention a specific preference during a chat, Claude remembers it for next time so you don't have to say it again.

| Feature | CLAUDE.md | Auto Memory |
| :--- | :--- | :--- |
| **Written by** | You | Claude |
| **Best for** | Strict standards & build commands | Small preferences & learned fixes |
| **Storage** | Committed to your repo | Local to your machine |

## Where to store your instructions

You can place \`CLAUDE.md\` files in different spots depending on who needs to see the rules.

1.  **Project Level (\`./CLAUDE.md\`):** Put this in your root folder. It’s for everyone on the team. Include things like \`npm run build\` commands and your preferred style guide.
2.  **User Level (\`~/.claude/CLAUDE.md\`):** Use this for your personal "vibes." If you always want Claude to use emojis or avoid semi-colons across *every* project you touch, put it here.
3.  **Local Level (\`./CLAUDE.local.md\`):** Use this for project secrets or personal shortcuts you don't want to check into Git. (Don't forget to add it to your \`.gitignore\`!)

## Tips for a great CLAUDE.md

Don't overcomplicate it. Treat it like a "ReadMe" for an AI. You should add to it whenever:
*   Claude makes the same mistake twice.
*   A human code reviewer points out something Claude should have known.
*   You find yourself pasting the same setup instructions into a new chat.

To get started quickly, just run the initialization command in your terminal:

\`\`\`bash
/init
\`\`\`

Claude will look at your files and try to write a starter \`CLAUDE.md\` for you.

## Organizing with Rules

If your project is huge, a single Markdown file gets messy. You can create a directory at \`.claude/rules/\` to store specific instructions. This is great for "scoping"—for example, you can have a rule that only triggers when Claude is touching CSS files, or a specific rule for your backend API folder. This keeps the "brain" focused on only what’s relevant to the current task.`,
  },
  {
    slug: "skills-portable-ai-expertise",
    kind: "lesson",
    number: 3,
    icon: "puzzle",
    title: "Skills: Portable AI Expertise",
    summary: "Install and create skills \u2014 packaged AI know-how you can carry between projects.",
    body: `# Skills: Portable AI Expertise

Think of skills as "packaged brains" for your AI. While \`CLAUDE.md\` is great for project-specific facts, it can get cluttered if you try to stuff it with complex checklists or playbooks. Skills solve this by creating on-demand expertise that only loads when needed. Best of all, they follow an open standard, meaning your AI "know-how" can travel with you across different tools and projects.

## Why use skills?

If you find yourself repeatedly typing the same instructions—like "write a unit test for this using Vitest" or "explain this code using a cooking analogy"—it’s time to make it a skill. 

Custom commands and skills have now merged into a single, powerful system. Whether you use a simple file in \`.claude/commands/\` or a structured folder in \`.claude/skills/\`, you can trigger them with a \`/\` slash command. Skills have the added benefit of being "discoverable"—Claude can decide to use one automatically if it fits your current task.

## Your first skill: The Code Explainer

Let’s create a skill that forces Claude to explain code using visual ASCII diagrams and analogies. We’ll put this in your "Personal" folder so it works across every project on your computer.

### 1. Set up the folder
Open your terminal and create a dedicated space for the skill:

\`\`\`bash
mkdir -p ~/.claude/skills/explain-code
\`\`\`

### 2. Craft the SKILL.md
Every skill needs a \`SKILL.md\` file. This contains **frontmatter** (the stuff between the \`---\` lines) to tell Claude when to use it, and **instructions** for what to do.

Create \`~/.claude/skills/explain-code/SKILL.md\` and paste this in:

\`\`\`yaml
---
description: Use this when the user wants to understand how code works. Helps explain logic with diagrams and analogies.
---

When you use this skill, follow these rules:
1. Start with a real-world analogy (like a kitchen or a post office).
2. Create an ASCII art diagram showing the data flow.
3. Give a step-by-step technical walkthrough.
4. End with a "Pro Tip" about a common pitfall in this pattern.
\`\`\`

### 3. Give it a spin
You can now use this skill in two ways within Claude Code:

*   **Manual:** Type \`/explain-code\` followed by a filename.
*   **Automatic:** Just ask, "How does this auth logic work?" Because of the \`description\` we wrote, Claude will realize it has a skill for that and load the instructions automatically.

## Where to store your skills

The location of your skill determines its "reach":

- **Personal (\`~/.claude/skills/\`):** Your global toolbox. Available in every project you work on.
- **Project (\`.claude/skills/\`):** Specific to one repo. Great for team-specific playbooks or deployment steps.
- **Bundled:** Built-in skills like \`/debug\` or \`/simplify\` that are always ready to go.

Claude Code is smart enough to watch these folders in real-time. If you edit a skill file, the changes take effect immediately—no need to restart your session. If you're working in a monorepo, Claude will even look for skills in nested subdirectories as you move around the codebase.`,
  },
  {
    slug: "mcp-servers-and-tool-connections",
    kind: "lesson",
    number: 4,
    icon: "plug",
    title: "MCP Servers & Tool Connections",
    summary: "Wire Claude Code into the rest of your stack with Model Context Protocol servers.",
    body: `# MCP Servers & Tool Connections

Think of Claude Code as a highly skilled developer who just arrived at your office. Out of the box, it’s great at logic and local files, but it doesn't have the keys to your other tools yet. This is where the **Model Context Protocol (MCP)** comes in. It’s the standard bridge that lets Claude talk to GitHub, Google Drive, Slack, or even your own internal databases.

By connecting MCP servers, you’re giving Claude "fingers" to interact with your stack directly.

## How Connections Work

Claude Code supports three main types of communication "transports" to talk to these tools:

1.  **Stdio:** This runs a command locally on your machine (often via \`npx\`). It's the most common way to plug in utility tools.
2.  **HTTP/SSE:** This connects to a server running at a specific web address. It’s perfect for shared tools or cloud-based services.

## Adding Your First Tool

The easiest way to hook up a new tool is using the \`claude mcp add\` command. You’ll need a name for the connection and the specific command or URL to reach it.

### Example: Connecting via NPX (Stdio)
If you want to add a tool that exists as an NPM package, you might run something like this:

\`\`\`bash
claude mcp add my-tool --transport stdio -- npx -y @username/server-name
\`\`\`

### Example: Connecting via URL (HTTP)
For tools hosted on a server, you just point Claude at the endpoint:

\`\`\`bash
claude mcp add web-tool --transport http https://mcp-server.example.com/api
\`\`\`

## Managing Your Stack

Once you start adding tools, you'll want to keep an eye on them. Here are the commands you'll use most often:

*   **List tools:** Run \`claude mcp list\` to see everything currently connected.
*   **Remove tools:** If you’re done with a specific integration, use \`claude mcp remove [name]\`.
*   **Environment Variables:** Some tools require API keys. You can pass these during setup using the \`--env\` flag:
    \`\`\`bash
    claude mcp add github --transport stdio --env GITHUB_TOKEN=your_token_here -- npx -y @modelcontextprotocol/server-github
    \`\`\`

## Finding New Tools

The MCP ecosystem is growing fast. Anthropic maintains a registry of "commercial-ready" servers that play nicely with Claude Code. Before you go hunting, you can check the primary documentation index at \`https://code.claude.com/docs/llms.txt\` to see the latest official recommendations and supported features.

When you add a server, Claude will automatically "discover" the available functions and start using them when it thinks they’ll help solve your task. It’s a bit like giving your terminal a set of superpowers.`,
  },
  {
    slug: "building-your-first-project",
    kind: "lesson",
    number: 5,
    icon: "wrench",
    title: "Building Your First Project",
    summary: "Use everything from Lessons 1\u20134 to ship a small end-to-end project with Claude as your pair.",
    body: `# Building Your First Project

In this lesson, we are putting everything you’ve learned into practice. Claude Code isn't just a chat box; it’s an agentic partner that can navigate your codebase, execute terminal commands, and help you ship real features from scratch.

### Gather Your Resources
Before diving into the code, it’s helpful to know what’s possible. You can find a full map of the available documentation for Claude’s LLM capabilities at:
\`https://code.claude.com/docs/llms.txt\`

Reviewing this index is a great way to discover advanced features before you start building.

## Setting Up Your Workspace

Claude Code lives where you do. Whether you prefer the terminal, a full desktop application, or staying inside your favorite IDE, getting started is straightforward.

### The Terminal (CLI)
For those who love the command line, you can install the agent with a single string. 

**For macOS or Linux:**
\`\`\`bash
curl -fsSL https://claude.ai/install.sh | bash
\`\`\`

**For Windows (PowerShell):**
\`\`\`powershell
irm https://claude.ai/install.ps1 | iex
\`\`\`

If you prefer package managers, you can also use Homebrew (\`brew install --cask claude-code\`) or WinGet (\`winget install Anthropic.ClaudeCode\`).

### IDE & Desktop Options
If you’d rather not live in the terminal, there are several "home bases" for your new AI pair:

*   **VS Code:** Grab the official extension from the Marketplace or run \`code --install-extension anthropic.claude-code\`. This lets you manage context and review diffs without switching windows.
*   **JetBrains:** A native plugin is available for IntelliJ, PyCharm, and WebStorm users.
*   **Desktop App:** A dedicated application is available for both macOS and Windows if you want a standalone experience.

## Connecting Your AI Provider

By default, the tool works seamlessly with Anthropic’s services. However, if your team uses a specific cloud provider, you’ll need to do a little prep work first:

*   **Amazon Bedrock:** Ensure you have model access enabled in your AWS console and your IAM credentials ready.
*   **Google Vertex AI:** You'll need an active GCP project with the Vertex API enabled and a service account configured.
*   **Microsoft Foundry:** Requires an Azure subscription with a provisioned Foundry resource.

Once your environment is set up and your provider is linked, you’re ready to start your first project. Just open your terminal in a fresh folder, call Claude, and tell it what you want to build!`,
  },
  {
    slug: "lesson-6",
    kind: "lesson",
    number: 6,
    icon: "puzzle",
    title: "Sub-agents & Specialised Helpers",
    summary: "Spin up focused sub-agents so Claude can delegate clearly bounded work.",
    body: `# Sub-agents & Specialised Helpers

Think of sub-agents as focused "interns" you can hire on the fly. Sometimes, your main conversation gets cluttered with 50 lines of grep results or massive log files that you don't really need to look at twice. Sub-agents handle that noise in their own separate workspace, giving you back only the relevant summary.

### Why use sub-agents?

By delegating specific tasks to a sub-agent, you keep your main chat clean and efficient. There are a few big wins here:
* **Cleaner Context:** Implementation details and messy terminal output stay in the sub-agent’s window.
* **Safety:** You can restrict a sub-agent so it can only read files but never edit them.
* **Speed and Cost:** You can assign simple tasks to a faster, cheaper model like Claude 3.5 Haiku.
* **Consistency:** If you find yourself giving the same instructions over and over (like "check this for security bugs"), you can build a specialized sub-agent once and reuse it across projects.

### Built-in Helpers

Claude Code comes with a few helpers already configured. You don’t usually need to call these—Claude is smart enough to spin them up when it needs a hand.

*   **Explore:** A speedy, read-only agent using Haiku. It’s perfect for searching the codebase without cluttering your main view.
*   **Plan:** Used when you're in "Plan Mode." It focuses on research to help build a strategy before any code is actually touched.
*   **General-purpose:** A fully-featured agent that can use all tools to research and execute complex, multi-step code changes.

### Creating Your First Custom Agent

Want a dedicated "Code Reviewer" or a "Documentation Specialist"? You can create your own agents easily using the \`/agents\` command.

1.  **Open the Manager:** Type \`/agents\` in your terminal.
2.  **Pick a Home:** Go to the **Library** tab. If you choose **Personal**, the agent lives in your global config (\`~/.claude/agents/\`) and follows you to every project.
3.  **Use AI to Build AI:** Select **Generate with Claude**. Tell it what you want, like: *"An agent that scans my React components and suggests ways to optimize performance and hooks."*
4.  **Set the Boundaries:** 
    *   **Tools:** If you only want it to suggest changes, give it **Read-only** access. If you want it to actually fix things, give it full access.
    *   **Model:** Choose **Sonnet** for heavy lifting or **Haiku** for quick look-ups.
    *   **UI:** Pick a custom color so you can easily spot which "intern" is currently working when you see the logs in your terminal.

Once saved, Claude will automatically recognize when a task matches your agent's description and offer to delegate the work.`,
  },
  {
    slug: "lesson-7",
    kind: "lesson",
    number: 7,
    icon: "wrench",
    title: "Hooks: Automating the Loop",
    summary: "Run scripts before and after Claude acts \u2014 guardrails, formatters, notifications.",
    body: `# Hooks: Automating the Loop

Think of hooks as your personal automation assistants. They are scripts or commands that Claude Code runs for you at specific moments—like right before it tries to delete a file or just after it finishes a complex task. They act as "guardrails" to keep things safe or as "helpers" to format your code and notify you when things are done.

## How Hooks Work

A hook is essentially a trigger. When something happens in Claude Code (an "event"), it checks to see if you’ve defined a command for that moment. If you have, Claude pauses, sends some data about what’s happening to your script via JSON, and waits for your script to finish before moving on.

You can set these up using standard shell commands, HTTP endpoints, or even custom LLM prompts.

## The Hook Lifecycle

Hooks fire at different cadences throughout your coding session. Understanding the "when" helps you decide which hook to use:

### 1. The Session Level
These run at the very beginning or the very end of your work.
*   **SessionStart:** Great for setting up your environment or checking for updates.
*   **SessionEnd:** Perfect for cleanup or logging how much work was done.

### 2. The Turn Level
These fire every time you send a message to Claude.
*   **UserPromptSubmit:** Runs right after you hit Enter, but before Claude reads your message. Use this to scan for sensitive data you might have accidentally pasted.
*   **Stop:** Fires once Claude has finished its entire response. This is a great place to trigger a notification that the task is complete.

### 3. The Tool Level (Inside the Loop)
This is where the magic happens. Since Claude can run tools (like editing files or running tests), hooks give you control over those actions.
*   **PreToolUse:** This allows you to inspect what Claude is about to do. You can even block the action if it doesn't meet your criteria.
*   **PostToolUse:** Runs after a tool successfully finishes. You could use this to automatically run a formatter like Prettier every time Claude edits a file.
*   **PermissionDenied:** If you're running in "auto-mode" and a tool is blocked, this hook lets you decide if Claude should try a different approach.

## Key Events to Know

| Event | When it kicks in |
| :--- | :--- |
| \`Setup\` | For one-time prep, usually in CI or when initializing a project. |
| \`PreToolUse\` | Before a tool executes. Use this to "bless" or "block" actions. |
| \`PostToolUse\` | After a tool finishes. Ideal for auto-formatting or linting. |
| \`CwdChanged\` | When Claude moves between directories (great for \`direnv\` users). |
| \`FileChanged\` | When a file on your disk is modified. |
| \`Notification\` | When Claude sends a system-level alert. |

## Why Use Them?

If you find yourself manually running the same command every time Claude finishes a task—like \`npm test\` or \`ruff check\`—you should automate it with a hook. It keeps the "vibe" of your coding session smooth and prevents those "oops" moments where Claude accidentally breaks a linting rule.`,
  },
  {
    slug: "lesson-8",
    kind: "lesson",
    number: 8,
    icon: "book",
    title: "Slash Commands You'll Actually Use",
    summary: "Build short, reusable commands so you stop retyping the same prompts.",
    body: `# Slash Commands You'll Actually Use

We’ve all been there: typing the same "Please explain this simply" or "Refactor this using our team’s style guide" prompts over and over. In Claude Code, you can stop the repetition by creating **Skills**. These are custom slash commands that turn your frequent workflows into one-word triggers. 

Think of a Skill as a lightweight playbook. Unlike the \`CLAUDE.md\` file (which Claude reads every time you start a chat), a Skill only loads when you ask for it. This keeps your token usage low and your context window clean.

## Built-in Power Tools

Before you build your own, try the bundled skills that ship with the tool. These aren't just hard-coded scripts; they are deep prompts that guide Claude through complex tasks:

*   \`/simplify\`: Strips away the jargon and makes code easier to read.
*   \`/debug\`: Systematically hunts for the root cause of an error.
*   \`/batch\`: Helps you process multiple files or tasks in one go.

## Creating Your First Custom Skill

Let’s build a skill called \`/explain-code\`. We want Claude to stop giving dry technical definitions and start using analogies and ASCII art. 

### 1. Set up the directory
You can make a skill "global" (available in every project) by putting it in your home folder. Open your terminal and run:

\`\`\`bash
mkdir -p ~/.claude/skills/explain-code
\`\`\`

### 2. Write the instructions
Inside that folder, create a file named \`SKILL.md\`. Every skill needs two parts: **Frontmatter** (to tell Claude when the skill is relevant) and **Instructions** (the actual playbook).

\`\`\`markdown
---
description: Explains code using metaphors and visual diagrams. Use when the user asks "how does this work?"
---

When I ask you to explain code, please follow this format:
1. **The Analogy**: Compare the logic to a real-world scenario (like a kitchen or a post office).
2. **The Map**: Create a simple ASCII art diagram of the data flow.
3. **The Walkthrough**: Explain the logic step-by-step.
\`\`\`

### 3. Take it for a spin
You don't even have to restart Claude Code. If you're in a session, it will notice the new file immediately. You can trigger it two ways:

*   **Explicitly**: Type \`/explain-code src/utils/auth.ts\`.
*   **Automatically**: Just ask "Hey, how does the auth logic work?" Because of the \`description\` in your frontmatter, Claude knows this is the perfect time to use your new skill.

## Where to Save Your Skills

You can choose how widely available your commands should be based on where you save the \`SKILL.md\` file:

| Scope | Location | Best For |
| :--- | :--- | :--- |
| **Personal** | \`~/.claude/skills/\` | General tools (like \`/summarize\` or \`/explain\`). |
| **Project** | \`.claude/skills/\` | Project-specific logic (like \`/deploy-dev\` or \`/check-lint\`). |
| **Nested** | \`src/frontend/.claude/skills/\` | Great for monorepos where the frontend team needs different tools than the backend team. |

If you ever have two skills with the same name, Claude will prioritize your personal settings over the project settings. Keep your commands snappy, your instructions clear, and let Claude handle the heavy lifting.`,
  },
  {
    slug: "lesson-9",
    kind: "lesson",
    number: 9,
    icon: "plug",
    title: "Headless Mode & Scripting",
    summary: "Drive Claude Code from CI, cron jobs, or any other script.",
    body: `# Headless Mode & Scripting

Sometimes you want Claude to do its thing without you having to sit there and chat with it. Whether you're setting up a CI/CD pipeline, a nightly cron job to clean up documentation, or a custom script to audit your code, Claude Code can run in a non-interactive "headless" mode. 

By using the Agent SDK (which powers the CLI), you can treat Claude like any other command-line tool.

## The Power of the \`-p\` Flag

The easiest way to put Claude to work programmatically is with the \`-p\` (or \`--print\`) flag. This tells Claude to take your prompt, execute the necessary steps, and stop once it's done.

\`\`\`bash
claude -p "Check the recent changes in main.go for common security flaws"
\`\`\`

In this mode, Claude still has access to your files and shell tools, but it won't wait for you to hit "Enter" between steps.

## Speeding Things Up with Bare Mode

By default, Claude loads your history, local configs, and any MCP servers you've set up. This is great for manual work, but in a script, you often want a "clean slate." 

Using the \`--bare\` flag makes Claude skip all that auto-discovery. It’s faster and ensures that a script running on your machine behaves exactly the same way on a teammate’s machine or a remote server.

\`\`\`bash
claude --bare -p "Write a changelog based on the last 5 commits" --allowedTools "Read,Bash"
\`\`\`

**Note:** In bare mode, Claude only knows about the tools you explicitly allow. You'll need to provide your API key via the \`ANTHROPIC_API_KEY\` environment variable since it won't check your local keychain.

## Handling Data and JSON

If you’re piping Claude’s output into another tool like \`jq\` or a database, you probably don't want plain conversational text. You can use \`--output-format json\` to get a structured response.

### Getting Specific Shapes
You can even force Claude to return data in a specific JSON schema. This is perfect for extracting information into a predictable format:

\`\`\`bash
claude -p "List all exported functions in api.js" \\
  --output-format json \\
  --json-schema '{"type":"object","properties":{"funcs":{"type":"array","items":{"type":"string"}}}}'
\`\`\`

### Real-time Streaming
If you’re building a UI or just hate waiting, use \`--output-format stream-json\`. This pushes out data line-by-line as Claude generates it. You can pair this with \`jq\` to watch the text stream in your terminal:

\`\`\`bash
claude -p "Explain how our auth flow works" --output-format stream-json --verbose --include-partial-messages | \\
  jq -rj 'select(.type == "stream_event" and .event.delta.type == "text_delta") | .event.delta.text'
\`\`\`

## Practical Tips for Scripting

*   **Auto-Approval:** Use \`--allowedTools\` followed by a list (like "Read,Edit") so Claude doesn't get stuck waiting for permission to change a file.
*   **System Prompts:** Use \`--append-system-prompt-file\` to give Claude specific instructions for a script (e.g., "You are a senior DevOps engineer reviewing PRs").
*   **Persistent Context:** If your script needs to remember what happened in a previous call, use the \`--continue\` flag to keep the thread going.`,
  },
  {
    slug: "lesson-10",
    kind: "lesson",
    number: 10,
    icon: "wrench",
    title: "Debugging Workflows",
    summary: "Common failure modes and the fastest way back to a working session.",
    body: `# Debugging Workflows

Even the best "vibe coding" sessions can hit a snag. When Claude Code starts acting up—whether it's dragging its feet or throwing errors—your goal is to get back into the flow as quickly as possible. This guide covers how to spot common issues and the fastest ways to fix them.

## The First Line of Defense: \`/doctor\`

If you aren't sure why things are breaking, let the tool diagnose itself.

- **Inside a session:** Type \`/doctor\` to check your settings, MCP server health, and memory usage.
- **Outside a session:** Use \`claude doctor\` in your terminal if the app won't even start.

## Performance and Stability

If your terminal feels sluggish or your computer fans are spinning up, Claude might be chewing through too much context or memory.

### Managing Resource Usage
Large projects can be demanding. Here is how to keep things snappy:
1. **Compact your context:** Use \`/compact\` frequently to sweep away old conversation history while keeping the important bits.
2. **Fresh starts:** Don't be afraid to close Claude and restart between big tasks.
3. **Filter the noise:** Make sure your \`.gitignore\` includes heavy folders like \`node_modules\` or build artifacts so Claude doesn't waste energy reading them.

If memory stays high, run \`/heapdump\`. On macOS, this saves a diagnostic file to your Desktop that you can share with the developers if you need to report a bug.

### Dealing with "Thrashing"
If you see an error about **Autocompact thrashing**, it means Claude tried to clear space, but the very next file it read filled the memory right back up. 
- Avoid reading massive files in one go. Ask Claude to read specific line ranges or functions instead.
- If a task is just too big, spin it off to a [subagent](/en/sub-agents) to give it its own clean workspace.

### The "Universal Fix": Restarting
If the command hangs, hit \`Ctrl+C\`. If that fails, kill the terminal tab. You won't lose your work—just run \`claude --resume\` in the same folder to pick up exactly where you left off.

## Search and Tooling Fixes

If \`@file\` mentions or searches aren't finding obvious files, it usually means the built-in search tool (\`ripgrep\`) is having trouble with your OS.

### Installing a Native Search Tool
You can fix most search issues by installing \`ripgrep\` directly on your system:

- **macOS:** \`brew install ripgrep\`
- **Windows:** \`winget install BurntSushi.ripgrep.MSVC\`
- **Linux:** Use your package manager (e.g., \`sudo apt install ripgrep\`)

After installing, set the environment variable \`USE_BUILTIN_RIPGREP=0\` to tell Claude to use your shiny new system version.

### Working on WSL
Windows Subsystem for Linux (WSL) can be slow when searching across the Windows/Linux boundary. For the best experience, keep your code on the Linux filesystem (\`/home/\` folders) rather than the \`/mnt/c/\` path. If search is still slow, try to be more specific (e.g., "Search for the login logic only in the /src folder").`,
  },
  {
    slug: "lesson-11",
    kind: "lesson",
    number: 11,
    icon: "book",
    title: "Tracking Cost & Usage",
    summary: "Understand pricing, monitor tokens, and keep your monthly bill predictable.",
    body: `# Tracking Cost & Usage

When you’re "vibe coding," it’s easy to get into a flow state and forget that every interaction with Claude involves sending and receiving tokens. Since Claude Code operates on a pay-as-you-go model via the API, keeping an eye on your usage ensures that your monthly bill doesn't come as a surprise.

## Keeping Tabs on Your Spend

The quickest way to check your current "tab" is right from the terminal. 

### The /usage Command
Type \`/usage\` at any time to see a snapshot of your session. It gives you a breakdown of:
* **Estimated Cost:** A local calculation of what your current session has cost so far.
* **Duration:** How long the API has been working versus how long the session has been open.
* **Activity:** A quick look at how many lines of code you’ve added or removed.

*Note: If you are on a Pro or Max subscription, these dollar amounts are just for your information, as usage is typically bundled with your plan. If you are using the API directly, keep in mind that the local estimate might vary slightly from your official bill in the Anthropic Console.*

## Managing Costs for Teams

If you’re an admin setting this up for a whole crew, Claude automatically creates a dedicated "Claude Code" workspace in your Console when you first authenticate. 

### Setting Boundaries
To keep things predictable, you can set **spend limits** in the Console to cap the total budget. We also recommend setting **Rate Limits** (Tokens Per Minute) based on your team size. Generally, as your team grows, not everyone uses the tool at the exact same second, so you can actually lower the "per-user" allocation as you scale. For a small team of five, 200k–300k TPM per person is a solid starting point.

## Proactive Ways to Save Tokens

The bigger your "context" (the history and files Claude is looking at), the more each message costs. Here is how to keep things lean:

### 1. Fresh Starts
When you finish one feature and start another, use the \`/clear\` command. This wipes the "memory" of the current session so you aren't paying to send old, irrelevant code back and forth with every new question. If you’re afraid to lose the history, just \`/rename\` the session first—you can always \`/resume\` it later.

### 2. Smart Compaction
When a conversation gets long, Claude "compacts" the history to save space. You can guide this process in your \`CLAUDE.md\` file or by typing \`/compact\` followed by instructions. For example:
\`\`\`text
/compact Focus on the recent refactor of the Auth component and ignore the CSS tweaks.
\`\`\`

### 3. Agent Team Discipline
If you use the experimental Agent Teams feature, remember that every "teammate" Claude spawns has its own context window. To keep costs down:
* Use **Sonnet** for teammates—it’s the best bang for your buck.
* Keep your "spawn prompts" short and focused.
* Close teammates as soon as they finish their specific task.

By staying mindful of your context and using the \`/usage\` command regularly, you can focus on building great software without worrying about the meter running too fast.`,
  },
  {
    slug: "lesson-12",
    kind: "lesson",
    number: 12,
    icon: "sparkles",
    title: "Wrapping Up & What's Next",
    summary: "Bring it all together and pick the next direction for your Claude Code practice.",
    body: `# Wrapping Up & What's Next

You’ve officially dipped your toes into the world of agentic coding. By now, you’ve seen how Claude Code isn't just a chatbot—it’s a collaborator that lives where you work, capable of digging through your files, executing terminal commands, and helping you ship better software faster.

### Where Can You Play?

The best thing about Claude Code is its flexibility. You aren't locked into one workflow. Depending on your "vibe," you can run it in a few different places:

*   **The Terminal:** Great for those who love staying in the flow of the command line.
*   **Desktop App:** A dedicated space for the full agent experience on macOS or Windows.
*   **IDEs:** If you live in VS Code or JetBrains (IntelliJ, PyCharm, etc.), there are native plugins to help you manage diffs and context without switching windows.

### Getting It Running Everywhere

If you haven't installed it on your main machine yet, here are the shortcuts to get moving:

**macOS or Linux:**
\`\`\`bash
curl -fsSL https://claude.ai/install.sh | bash
\`\`\`

**Windows (PowerShell):**
\`\`\`powershell
irm https://claude.ai/install.ps1 | iex
\`\`\`

**Homebrew Users:**
\`\`\`bash
brew install --cask claude-code
\`\`\`

**VS Code Extension:**
\`\`\`bash
code --install-extension anthropic.claude-code
\`\`\`

### Choosing Your Power Source

While most people start with a standard Anthropic account, Claude Code is built for the enterprise too. If you’re at a company that prefers specific cloud providers, you can hook it up to **Amazon Bedrock**, **Google Vertex AI**, or **Microsoft Foundry**. Just remember that those usually require a bit of extra setup in your cloud console (like enabling model access or setting up IAM credentials) before the CLI can talk to them.

### Keep Exploring

We’ve only scratched the surface. To see the full list of what this agent can do, I highly recommend checking out the master documentation index maintained by the Anthropic team. It’s the best way to stay updated on new features as they roll out.

**Dive deeper here:** [https://code.claude.com/docs/llms.txt](https://code.claude.com/docs/llms.txt)

You’re ready to start vibe coding for real. Pick a project, fire up your terminal, and see where Claude can take you!`,
  }
];

export const getLesson = (slug: string) => lessons.find((l) => l.slug === slug);

export const bodyFor = (body: LessonBody, os: OS): string => {
  if (typeof body === "string") return body;
  return body[os] ?? body.mac ?? body.linux ?? body.windows ?? "";
};
