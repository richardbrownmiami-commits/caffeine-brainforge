#!/usr/bin/env node
// BrainForge Brain Server - runs on your Termux phone
// Setup: npm install express axios cors
// Run: node brain.js YOUR_OPENROUTER_KEY

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const KEY = process.argv[2] || process.env.OPENROUTER_KEY || "";
const PROJECTS = path.join(process.env.HOME || ".", "brainforge-projects");
if (!fs.existsSync(PROJECTS)) fs.mkdirSync(PROJECTS, { recursive: true });

if (!KEY) {
  console.warn("[BrainForge] WARNING: No OpenRouter key provided.");
  console.warn("[BrainForge] Usage: node brain.js YOUR_OPENROUTER_KEY");
  console.warn("[BrainForge] Get a free key at https://openrouter.ai\n");
}

app.get("/api/status", (_, res) => {
  res.json({ ok: true, version: "1.0.0", hasKey: !!KEY });
});

app.post("/api/chat", async (req, res) => {
  const { message, history = [], projectName = "untitled" } = req.body;
  if (!KEY) {
    return res.status(400).json({ error: "No OpenRouter key configured. Restart: node brain.js YOUR_KEY" });
  }
  try {
    const r = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "nvidia/llama-3.1-nemotron-ultra-253b-v1:free",
        messages: [
          {
            role: "system",
            content: `You are BrainForge AI, an expert app builder. When generating code, always wrap each file in a fenced code block with the language tag (html, css, javascript). Generate complete, working, self-contained code. Current project: ${projectName}`,
          },
          ...history,
          { role: "user", content: message },
        ],
      },
      {
        headers: {
          Authorization: "Bearer " + KEY,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://brainforge.app",
          "X-Title": "BrainForge",
        },
        timeout: 60000,
      }
    );
    const reply = r.data.choices?.[0]?.message?.content || "No response generated";
    res.json({ reply });
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.message || "Unknown error";
    res.status(500).json({ error: msg });
  }
});

app.post("/api/files/write", (req, res) => {
  const { project, filename, content } = req.body;
  if (!project || !filename) return res.status(400).json({ error: "Missing project or filename" });
  const dir = path.join(PROJECTS, project);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content || "");
  console.log(`[BrainForge] Wrote ${filename} to ${project}`);
  res.json({ ok: true });
});

app.get("/api/files/read", (req, res) => {
  const { project, file } = req.query;
  if (!project || !file) return res.status(400).json({ error: "Missing project or file" });
  const filePath = path.join(PROJECTS, project, file);
  if (!fs.existsSync(filePath)) return res.json({ content: "" });
  res.json({ content: fs.readFileSync(filePath, "utf8") });
});

app.post("/api/run", (req, res) => {
  const { command, project } = req.body;
  if (!command) return res.status(400).json({ error: "Missing command" });
  const cwd = project ? path.join(PROJECTS, project) : PROJECTS;
  if (!fs.existsSync(cwd)) fs.mkdirSync(cwd, { recursive: true });
  try {
    const output = execSync(command, { cwd, timeout: 30000, maxBuffer: 1024 * 1024 }).toString();
    res.json({ output, success: true });
  } catch (e) {
    const output = e.stderr?.toString() || e.stdout?.toString() || e.message || "Command failed";
    res.json({ output, success: false });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║       BrainForge Brain Server         ║
╠═══════════════════════════════════════╣
║  Running on port ${PORT}                  ║
║  Projects: ~/brainforge-projects      ║
║  Key: ${KEY ? "✓ Configured" : "✗ Not set"}                   ║
╚═══════════════════════════════════════╝

Next step — expose with ngrok:
  ngrok http ${PORT}

Then copy the Forwarding URL into BrainForge Settings.
`);
});
