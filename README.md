# WorkAtAStartup Ai Automation

Automated job application bot for [WorkAtAStartup.com](https://www.workatastartup.com/). Parses your resume, uses local LLMs to match relevant jobs via semantic similarity, and auto-fills applications with AI-generated cover letters.

Currently in testing mode -- applications are filled but not submitted.

## Tech Stack

- Electron + React + TypeScript (desktop app)
- Tailwind CSS + Shadcn/ui (styling)
- Playwright Core (browser automation via CDP)
- Ollama (local LLM inference)
- pdf-parse (resume PDF extraction)

## Prerequisites

- Node.js
- [Ollama](https://ollama.com/) running locally
- Pull required models:

```
ollama pull gemma3:4b
ollama pull qwen3-embedding:0.6b
```

## Setup

```
npm install
cp .env.example .env
npm run dev
```

## How It Works

1. Upload your resume (PDF)
2. AI generates a "target job persona" and embeddings from your resume
3. Click start -- a browser opens WorkAtAStartup.com
4. For each company/job listing:
   - Job title is checked against your profile using embedding similarity
   - If title matches, full description is evaluated
   - If relevant, a cover letter is generated and filled into the application form
5. Real-time activity log shows match scores, skips, and status

Pause/resume is supported mid-automation.

## Build

```
npm run build:win     # Windows
npm run build:mac     # macOS
npm run build:linux   # Linux
```
