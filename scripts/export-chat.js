#!/usr/bin/env node
/**
 * Chat Export Script
 * 
 * Помогает документировать важные разговоры с Copilot и Continue.dev.
 * 
 * Использование:
 *   node scripts/export-chat.js -i              # Интерактивный режим
 *   node scripts/export-chat.js --continue      # Экспорт всех сессий Continue.dev
 *   node scripts/export-chat.js --continue -n 5 # Экспорт последних 5 сессий
 *   node scripts/export-chat.js --search "API"  # Поиск по всем сессиям
 *   node scripts/export-chat.js "Topic" "Summary" "Decision1" "Decision2" ...
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHAT_LOG_PATH = path.join(__dirname, '../.vscode/CHAT_LOG.md');
const CONTINUE_SESSIONS_PATH = path.join(os.homedir(), '.continue', 'sessions');
const CONTINUE_EXPORT_PATH = path.join(__dirname, '../.vscode/CONTINUE_HISTORY.md');

/**
 * Добавляет запись в лог чата
 */
function logChatSession(topic, summary, decisions = [], files = []) {
  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toTimeString().split(' ')[0];
  
  const entry = `
## ${date} ${time} - ${topic}

### Summary
${summary}

### Decisions
${decisions.length > 0 ? decisions.map(d => `- ${d}`).join('\n') : '- No specific decisions recorded'}

### Files Affected
${files.length > 0 ? files.map(f => `- \`${f}\``).join('\n') : '- No files recorded'}

---
`;

  // Создаём файл если не существует
  if (!fs.existsSync(CHAT_LOG_PATH)) {
    const header = `# Copilot Chat Log

This file documents important conversations and decisions made during development.

Use \`node scripts/export-chat.js\` to add entries.

---
`;
    fs.writeFileSync(CHAT_LOG_PATH, header);
  }

  // Добавляем запись
  fs.appendFileSync(CHAT_LOG_PATH, entry);
  
  console.log(`✅ Chat session logged to ${CHAT_LOG_PATH}`);
  console.log(`   Topic: ${topic}`);
  console.log(`   Decisions: ${decisions.length}`);
  console.log(`   Files: ${files.length}`);
}

/**
 * Парсит сессии Continue.dev
 */
function parseContinueSessions(limit = null) {
  if (!fs.existsSync(CONTINUE_SESSIONS_PATH)) {
    console.log(`❌ Continue.dev sessions folder not found at: ${CONTINUE_SESSIONS_PATH}`);
    console.log(`   Make sure Continue.dev extension is installed and has been used.`);
    return [];
  }

  const files = fs.readdirSync(CONTINUE_SESSIONS_PATH)
    .filter(f => f.endsWith('.json'))
    .map(f => ({
      name: f,
      path: path.join(CONTINUE_SESSIONS_PATH, f),
      mtime: fs.statSync(path.join(CONTINUE_SESSIONS_PATH, f)).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime); // Newest first

  const sessionsToProcess = limit ? files.slice(0, limit) : files;
  const sessions = [];

  for (const file of sessionsToProcess) {
    try {
      const content = fs.readFileSync(file.path, 'utf-8');
      const data = JSON.parse(content);
      sessions.push({
        id: file.name.replace('.json', ''),
        date: file.mtime,
        title: data.title || 'Untitled Session',
        messages: data.history || data.messages || []
      });
    } catch (e) {
      console.log(`⚠️ Could not parse ${file.name}: ${e.message}`);
    }
  }

  return sessions;
}

/**
 * Экспортирует сессии Continue.dev в Markdown
 */
function exportContinueSessions(limit = null) {
  const sessions = parseContinueSessions(limit);
  
  if (sessions.length === 0) {
    return;
  }

  let markdown = `# Continue.dev Chat History

Exported: ${new Date().toISOString()}
Sessions: ${sessions.length}

Use CTRL+F to search!

---
`;

  for (const session of sessions) {
    const dateStr = session.date.toISOString().split('T')[0];
    const timeStr = session.date.toTimeString().split(' ')[0];
    
    markdown += `
## ${dateStr} ${timeStr} - ${session.title}

**Session ID:** \`${session.id}\`

`;

    for (const msg of session.messages) {
      const role = msg.role === 'user' ? '👤 **User**' : '🤖 **Assistant**';
      const content = typeof msg.content === 'string' 
        ? msg.content 
        : JSON.stringify(msg.content, null, 2);
      
      markdown += `### ${role}

${content}

`;
    }

    markdown += `---
`;
  }

  fs.writeFileSync(CONTINUE_EXPORT_PATH, markdown);
  console.log(`✅ Exported ${sessions.length} sessions to ${CONTINUE_EXPORT_PATH}`);
  console.log(`   Open the file and use CTRL+F to search!`);
}

/**
 * Поиск по всем сессиям Continue.dev
 */
function searchContinueSessions(query) {
  const sessions = parseContinueSessions();
  
  if (sessions.length === 0) {
    return;
  }

  const queryLower = query.toLowerCase();
  const results = [];

  for (const session of sessions) {
    for (let i = 0; i < session.messages.length; i++) {
      const msg = session.messages[i];
      const content = typeof msg.content === 'string' 
        ? msg.content 
        : JSON.stringify(msg.content);
      
      if (content.toLowerCase().includes(queryLower)) {
        results.push({
          session: session.title,
          sessionId: session.id,
          date: session.date,
          role: msg.role,
          content: content,
          messageIndex: i
        });
      }
    }
  }

  if (results.length === 0) {
    console.log(`❌ No results found for: "${query}"`);
    return;
  }

  console.log(`\n🔍 Found ${results.length} matches for "${query}":\n`);
  
  for (const result of results.slice(0, 20)) { // Show max 20 results
    const dateStr = result.date.toISOString().split('T')[0];
    const preview = result.content.substring(0, 200).replace(/\n/g, ' ');
    
    console.log(`📅 ${dateStr} | ${result.session}`);
    console.log(`   ${result.role}: ${preview}...`);
    console.log(`   Session ID: ${result.sessionId}`);
    console.log('');
  }

  if (results.length > 20) {
    console.log(`   ... and ${results.length - 20} more results`);
  }
}

/**
 * Интерактивный режим
 */
async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  console.log('\n📝 Copilot Chat Export - Interactive Mode\n');

  const topic = await question('Topic/Title: ');
  const summary = await question('Summary (what was discussed): ');
  
  console.log('\nDecisions (enter each on new line, empty line to finish):');
  const decisions = [];
  let decision;
  while ((decision = await question('  - ')) !== '') {
    decisions.push(decision);
  }

  console.log('\nFiles affected (enter each on new line, empty line to finish):');
  const files = [];
  let file;
  while ((file = await question('  - ')) !== '') {
    files.push(file);
  }

  rl.close();

  logChatSession(topic, summary, decisions, files);
}

/**
 * Показать помощь
 */
function showHelp() {
  console.log(`
📝 Chat Export Script - Help

Usage:
  node scripts/export-chat.js [options] [arguments]

Options:
  -i, --interactive     Interactive mode for manual entry
  -c, --continue        Export Continue.dev sessions to Markdown
  -n, --number <N>      Limit number of sessions to export (use with --continue)
  -s, --search <query>  Search through all Continue.dev sessions
  -h, --help            Show this help

Examples:
  node scripts/export-chat.js -i
    → Interactive mode to log a chat session

  node scripts/export-chat.js --continue
    → Export ALL Continue.dev sessions to .vscode/CONTINUE_HISTORY.md

  node scripts/export-chat.js --continue -n 5
    → Export last 5 Continue.dev sessions

  node scripts/export-chat.js --search "API key"
    → Search for "API key" in all sessions

  node scripts/export-chat.js "Topic" "Summary" "Decision1" "Decision2"
    → Quick add to chat log

Output Files:
  .vscode/CHAT_LOG.md         Manual entries
  .vscode/CONTINUE_HISTORY.md Continue.dev export (CTRL+F searchable!)
`);
}

// Main
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  showHelp();
} else if (args.includes('--interactive') || args.includes('-i')) {
  interactiveMode();
} else if (args.includes('--continue') || args.includes('-c')) {
  const nIndex = args.findIndex(a => a === '-n' || a === '--number');
  const limit = nIndex !== -1 ? parseInt(args[nIndex + 1]) : null;
  exportContinueSessions(limit);
} else if (args.includes('--search') || args.includes('-s')) {
  const sIndex = args.findIndex(a => a === '-s' || a === '--search');
  const query = args[sIndex + 1];
  if (!query) {
    console.log('❌ Please provide a search query: --search "your query"');
  } else {
    searchContinueSessions(query);
  }
} else if (args.length >= 2) {
  const [topic, summary, ...decisions] = args;
  logChatSession(topic, summary, decisions, []);
} else {
  showHelp();
}

---
`;
    fs.writeFileSync(CHAT_LOG_PATH, header);
  }

  // Добавляем запись
  fs.appendFileSync(CHAT_LOG_PATH, entry);
  
  console.log(`✅ Chat session logged to ${CHAT_LOG_PATH}`);
  console.log(`   Topic: ${topic}`);
  console.log(`   Decisions: ${decisions.length}`);
  console.log(`   Files: ${files.length}`);
}

/**
 * Интерактивный режим
 */
async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  console.log('\n📝 Copilot Chat Export - Interactive Mode\n');

  const topic = await question('Topic/Title: ');
  const summary = await question('Summary (what was discussed): ');
  
  console.log('\nDecisions (enter each on new line, empty line to finish):');
  const decisions = [];
  let decision;
  while ((decision = await question('  - ')) !== '') {
    decisions.push(decision);
  }

  console.log('\nFiles affected (enter each on new line, empty line to finish):');
  const files = [];
  let file;
  while ((file = await question('  - ')) !== '') {
    files.push(file);
  }

  rl.close();

  logChatSession(topic, summary, decisions, files);
}

/**
 * Режим командной строки
 */
function cliMode(args) {
  if (args.length < 2) {
    console.log(`
Usage: node scripts/export-chat.js <topic> <summary> [decision1] [decision2] ...

Options:
  --interactive, -i    Interactive mode
  --help, -h          Show this help

Examples:
  node scripts/export-chat.js "API Key Storage" "Discussed backend storage for API keys" "Store in SQLite" "Use encryption"
  node scripts/export-chat.js -i
`);
    process.exit(1);
  }

  const [topic, summary, ...decisions] = args;
  logChatSession(topic, summary, decisions, []);
}

// Main
const args = process.argv.slice(2);

if (args.includes('--interactive') || args.includes('-i')) {
  interactiveMode();
} else if (args.includes('--help') || args.includes('-h')) {
  cliMode([]);
} else {
  cliMode(args);
}
