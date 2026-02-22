#!/usr/bin/env node
/**
 * Chat History Manager
 * 
 * Интерактивное меню для работы с историей чатов.
 * Просто запусти: npm run chat
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import os from 'os';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHAT_LOG_PATH = path.join(__dirname, '../.vscode/CHAT_LOG.md');
const CONTINUE_SESSIONS_PATH = path.join(os.homedir(), '.continue', 'sessions');
const CONTINUE_EXPORT_PATH = path.join(__dirname, '../.vscode/CONTINUE_HISTORY.md');

// ─────────────────────────────────────────────────────────────
// УТИЛИТЫ
// ─────────────────────────────────────────────────────────────

function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function question(rl, prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

function openFile(filePath) {
  const cmd = process.platform === 'win32' ? `code "${filePath}"` : `open "${filePath}"`;
  exec(cmd, (err) => {
    if (err) {
      console.log(`📂 Файл: ${filePath}`);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// ПАРСИНГ CONTINUE.DEV
// ─────────────────────────────────────────────────────────────

function parseContinueSessions(limit = null) {
  if (!fs.existsSync(CONTINUE_SESSIONS_PATH)) {
    return { error: 'not_found', path: CONTINUE_SESSIONS_PATH };
  }

  const files = fs.readdirSync(CONTINUE_SESSIONS_PATH)
    .filter(f => f.endsWith('.json'))
    .map(f => ({
      name: f,
      path: path.join(CONTINUE_SESSIONS_PATH, f),
      mtime: fs.statSync(path.join(CONTINUE_SESSIONS_PATH, f)).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    return { error: 'empty', path: CONTINUE_SESSIONS_PATH };
  }

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
      // Skip invalid files
    }
  }

  return { sessions };
}

// ─────────────────────────────────────────────────────────────
// ФУНКЦИИ МЕНЮ
// ─────────────────────────────────────────────────────────────

function exportContinueSessions(limit = null) {
  const result = parseContinueSessions(limit);
  
  if (result.error === 'not_found') {
    console.log(`\n❌ Папка Continue.dev не найдена: ${result.path}`);
    console.log(`   Установи Continue.dev и поговори с ним хотя бы раз.\n`);
    return false;
  }

  if (result.error === 'empty') {
    console.log(`\n❌ Нет сессий в Continue.dev. Сначала поговори с ним.\n`);
    return false;
  }

  const sessions = result.sessions;
  let markdown = `# Continue.dev История Чатов

Экспортировано: ${new Date().toLocaleString('ru-RU')}
Сессий: ${sessions.length}

**Используй CTRL+F для поиска!**

---
`;

  for (const session of sessions) {
    const dateStr = session.date.toLocaleDateString('ru-RU');
    const timeStr = session.date.toLocaleTimeString('ru-RU');
    
    markdown += `\n## 📅 ${dateStr} ${timeStr} - ${session.title}\n\n`;

    for (const msg of session.messages) {
      const role = msg.role === 'user' ? '👤 **Ты**' : '🤖 **AI**';
      const content = typeof msg.content === 'string' 
        ? msg.content 
        : JSON.stringify(msg.content, null, 2);
      
      markdown += `### ${role}\n\n${content}\n\n`;
    }

    markdown += `---\n`;
  }

  // Создаём .vscode если нет
  const vscodeDir = path.dirname(CONTINUE_EXPORT_PATH);
  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir, { recursive: true });
  }

  fs.writeFileSync(CONTINUE_EXPORT_PATH, markdown);
  console.log(`\n✅ Экспортировано ${sessions.length} сессий`);
  console.log(`📂 Файл: ${CONTINUE_EXPORT_PATH}`);
  console.log(`💡 Открой файл и используй CTRL+F для поиска!\n`);
  return true;
}

function searchContinueSessions(query) {
  const result = parseContinueSessions();
  
  if (result.error) {
    console.log(`\n❌ Continue.dev история не найдена.\n`);
    return;
  }

  const sessions = result.sessions;
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
          date: session.date,
          role: msg.role === 'user' ? '👤 Ты' : '🤖 AI',
          content: content
        });
      }
    }
  }

  if (results.length === 0) {
    console.log(`\n❌ Ничего не найдено по запросу: "${query}"\n`);
    return;
  }

  console.log(`\n🔍 Найдено ${results.length} совпадений для "${query}":\n`);
  
  for (const r of results.slice(0, 10)) {
    const dateStr = r.date.toLocaleDateString('ru-RU');
    const preview = r.content.substring(0, 150).replace(/\n/g, ' ');
    
    console.log(`📅 ${dateStr} | ${r.session}`);
    console.log(`   ${r.role}: ${preview}...`);
    console.log('');
  }

  if (results.length > 10) {
    console.log(`   ... и ещё ${results.length - 10} результатов`);
    console.log(`   Для просмотра всех — экспортируй и используй CTRL+F\n`);
  }
}

async function manualEntry(rl) {
  console.log('\n📝 Запись вручную\n');

  const topic = await question(rl, 'Тема: ');
  if (!topic) {
    console.log('❌ Тема обязательна\n');
    return;
  }

  const summary = await question(rl, 'Краткое описание: ');
  
  console.log('\nВажные решения (Enter для завершения):');
  const decisions = [];
  let d;
  while ((d = await question(rl, '  • ')) !== '') {
    decisions.push(d);
  }

  // Записываем
  const date = new Date().toLocaleDateString('ru-RU');
  const time = new Date().toLocaleTimeString('ru-RU');
  
  const entry = `
## 📅 ${date} ${time} - ${topic}

${summary}

${decisions.length > 0 ? '### Решения\n' + decisions.map(d => `- ${d}`).join('\n') : ''}

---
`;

  // Создаём файл если не существует
  if (!fs.existsSync(CHAT_LOG_PATH)) {
    const header = `# 📝 Лог Чатов

Ручные записи важных разговоров.

---
`;
    fs.writeFileSync(CHAT_LOG_PATH, header);
  }

  fs.appendFileSync(CHAT_LOG_PATH, entry);
  console.log(`\n✅ Записано в ${CHAT_LOG_PATH}\n`);
}

// ─────────────────────────────────────────────────────────────
// ГЛАВНОЕ МЕНЮ
// ─────────────────────────────────────────────────────────────

async function showMenu() {
  const rl = createReadline();

  while (true) {
    console.log(`
╔═══════════════════════════════════════════════╗
║          📝 Chat History Manager              ║
╠═══════════════════════════════════════════════╣
║                                               ║
║   1. Экспорт Continue.dev → файл (CTRL+F)     ║
║   2. Поиск по истории                         ║
║   3. Записать вручную                         ║
║   4. Открыть файл истории                     ║
║                                               ║
║   0. Выход                                    ║
║                                               ║
╚═══════════════════════════════════════════════╝
`);

    const choice = await question(rl, 'Выбор [0-4]: ');

    switch (choice.trim()) {
      case '1':
        exportContinueSessions();
        break;

      case '2':
        const query = await question(rl, '\n🔍 Что искать: ');
        if (query.trim()) {
          searchContinueSessions(query.trim());
        }
        break;

      case '3':
        await manualEntry(rl);
        break;

      case '4':
        console.log('\nКакой файл открыть?');
        console.log('  1. Continue.dev история');
        console.log('  2. Ручные записи');
        const fileChoice = await question(rl, 'Выбор [1-2]: ');
        
        if (fileChoice === '1') {
          if (fs.existsSync(CONTINUE_EXPORT_PATH)) {
            openFile(CONTINUE_EXPORT_PATH);
            console.log(`\n📂 Открываю ${CONTINUE_EXPORT_PATH}\n`);
          } else {
            console.log('\n❌ Сначала экспортируй историю (пункт 1)\n');
          }
        } else if (fileChoice === '2') {
          if (fs.existsSync(CHAT_LOG_PATH)) {
            openFile(CHAT_LOG_PATH);
            console.log(`\n📂 Открываю ${CHAT_LOG_PATH}\n`);
          } else {
            console.log('\n❌ Файл ещё не создан. Сначала сделай запись (пункт 3)\n');
          }
        }
        break;

      case '0':
      case '':
        console.log('\n👋 Пока!\n');
        rl.close();
        process.exit(0);

      default:
        console.log('\n❓ Неизвестный выбор. Введи число от 0 до 4.\n');
    }

    await question(rl, 'Нажми Enter для продолжения...');
  }
}

// ─────────────────────────────────────────────────────────────
// CLI РЕЖИМ (для обратной совместимости)
// ─────────────────────────────────────────────────────────────

function showHelp() {
  console.log(`
📝 Chat History Manager

Использование:
  npm run chat              Интерактивное меню (рекомендуется)
  npm run chat -- --help    Эта справка

CLI команды (для скриптов):
  --continue, -c           Экспорт Continue.dev в файл
  --search, -s "запрос"    Поиск по истории
  --interactive, -i        Ручная запись

Примеры:
  npm run chat                        → Открыть меню
  npm run chat -- --continue          → Экспорт истории
  npm run chat -- --search "API key"  → Найти "API key"
`);
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.length === 0) {
  // Без аргументов — показываем интерактивное меню
  showMenu();
} else if (args.includes('--help') || args.includes('-h')) {
  showHelp();
} else if (args.includes('--continue') || args.includes('-c')) {
  const nIndex = args.findIndex(a => a === '-n' || a === '--number');
  const limit = nIndex !== -1 ? parseInt(args[nIndex + 1]) : null;
  exportContinueSessions(limit);
} else if (args.includes('--search') || args.includes('-s')) {
  const sIndex = args.findIndex(a => a === '-s' || a === '--search');
  const query = args[sIndex + 1];
  if (!query) {
    console.log('❌ Укажи запрос: npm run chat -- --search "запрос"');
  } else {
    searchContinueSessions(query);
  }
} else if (args.includes('--interactive') || args.includes('-i')) {
  const rl = createReadline();
  manualEntry(rl).then(() => rl.close());
} else {
  showHelp();
}
