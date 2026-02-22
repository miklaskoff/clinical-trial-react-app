# Copilot Custom Commands

## ⛔ MANDATORY WORKFLOW — 4 GATES

**КАЖДАЯ задача проходит 4 GATE. Пропуск ЗАПРЕЩЁН.**

```
@plan → [user approval] → @implement → @verify → [user approval] → @ship
```

**Нельзя:**
- ❌ Реализовывать без @plan
- ❌ Коммитить без @verify  
- ❌ Говорить "готово" без @ship
- ❌ @ship без git push

---

## Использование

В чате Copilot: `@workspace смотри .vscode/copilot-commands.md @plan - [задача]`

Или короче: `Следуй @plan: [задача]`

---

## GATE 1: @plan

**Показать план, НЕ реализовывать.**

### Output Format:

```markdown
## PLAN: [Task Name]

### Files to Modify
- [ ] file1.js — what changes
- [ ] file2.js — what changes

### Files to Create
- [ ] newfile.js — purpose

### Tests to Write
- [ ] test1.test.js — what it tests

### Implementation Contract (если сложная фича)
- Requirement: [что должно работать]
- Acceptance Test: [какой тест докажет что работает]
- Anti-Pattern: [что НЕ считается решением]

### Estimated Changes
- Lines added: ~N
- Lines removed: ~N

---
**⏸️ WAITING FOR APPROVAL**
Type "proceed", "go", или "одобрено" to continue to GATE 2.
```

**⛔ НЕ ПЕРЕХОДИТЬ К GATE 2 без явного одобрения пользователя**

---

## GATE 2: @implement

**Реализовать после одобрения плана.**

### Steps:
1. [ ] Write tests FIRST (TDD)
2. [ ] Implement code
3. [ ] Run `npm test`
4. [ ] Show test output

### Output Format:

```markdown
## IMPLEMENTATION COMPLETE

### Tests Created/Modified
- file.test.js — N tests added

### Code Changes
- file.js — what changed

### Test Results
[paste npm test output]

---
**⏸️ READY FOR VERIFICATION**
Type "@verify" to proceed to GATE 3.
```

**⛔ НЕ КОММИТИТЬ. НЕ ПУШИТЬ. ЖДАТЬ @verify.**

---

## GATE 3: @verify

**Проверить ВСЁ перед коммитом. ВКЛЮЧАЕТ @standards + @review + Implementation Contract.**

### Part A: Standards Compliance (из copilot-instructions.md)

**A1. Mandatory Development Rules:**

| Rule | Question | Status |
|------|----------|--------|
| TDD | Тесты написаны ДО кода? | ✅/❌ |
| All tests pass | `npm test` проходит? | ✅/❌ |
| Double-check | Результат проверен ДВАЖДЫ? | ✅/❌ |

**A2. Async/Parallel Rules:**

| Rule | Question | Status |
|------|----------|--------|
| Async | Все async операции через async/await? | ✅/❌ |
| Parallel | Promise.all() где возможно? | ✅/❌ |
| DB Optimized | SQLite с индексами, async? | ✅/❌ |

**A3. Security Rules:**

| Rule | Question | Status |
|------|----------|--------|
| No secrets | API ключи только в .env (backend)? | ✅/❌ |
| No frontend keys | Нет API ключей в localStorage/frontend? | ✅/❌ |

**A4. Refactoring Rules:**

| Rule | Question | Status |
|------|----------|--------|
| Grep before delete | grep выполнен перед удалением переменной/функции? | ✅/❌/N/A |
| All usages updated | Все использования обновлены? | ✅/❌/N/A |

### Part B: Code Review (из @review)

| Check | Question | Status |
|-------|----------|--------|
| Logic | Код делает то, что задумано? | ✅/❌ |
| Error handling | Все edge cases покрыты? | ✅/❌ |
| Performance | Нет лишних re-renders, async где нужно? | ✅/❌ |
| Security | Нет секретов, валидация данных? | ✅/❌ |
| Accessibility | ARIA labels, keyboard navigation? | ✅/❌/N/A |
| Tests | Тесты проверяют РЕАЛЬНОЕ поведение (не моки)? | ✅/❌ |

### Part C: Implementation Contract (если была сложная фича)

| Contract Item | Verified? | Evidence |
|---------------|-----------|----------|
| Requirement met | ✅/❌ | [как проверил] |
| Acceptance test passes | ✅/❌ | [вывод теста] |
| No anti-patterns | ✅/❌ | [что проверил] |
| Manual verification | ✅/❌ | [что видел в браузере] |

### Part D: Lessons Learned Applied (из .github/lesson learned.md)

**Прочитай lesson learned.md и проверь НЕ ПОВТОРЯЕШЬ ЛИ ОШИБКИ:**

| Past Mistake | Avoided? | How |
|--------------|----------|-----|
| Forgot grep before refactor | ✅/❌/N/A | [ran grep / no refactoring] |
| parseLimit parsed first N not new N | ✅/❌/N/A | [correct logic / not applicable] |
| VS Code kills idle processes | ✅/❌/N/A | [used batch file / not long-running] |
| Forgot git push | ✅/❌/N/A | [will push in @ship] |
| Encoding issues in terminal | ✅/❌/N/A | [chcp set / not using .bat] |

### Part E: Documentation Check

| Doc | Updated? | Evidence |
|-----|----------|----------|
| CHANGELOG.md | ✅/❌/N/A | [diff or "internal change"] |
| lesson learned.md | ✅/❌/N/A | [diff or "not a bug fix"] |
| README.md | ✅/❌/N/A | [diff or "no user-facing change"] |
| copilot-instructions.md | ✅/❌/N/A | [diff or "no new pattern"] |
| BACKUP_CATALOG.md | ✅/❌/N/A | [diff or "no backup created"] |

### Part F: Verification Commands

```bash
npm test
# [paste output — X tests passed]

npm run verify
# [paste output]

git status
# [paste output]
```

### Part G: Files to Commit
- file1.js
- file2.js
- ...

---

**VERIFICATION SUMMARY**

| Part | Status |
|------|--------|
| A. Standards | ✅/❌ |
| B. Code Review | ✅/❌ |
| C. Implementation Contract | ✅/❌/N/A |
| D. Lessons Applied | ✅/❌ |
| E. Documentation | ✅/❌ |
| F. Verification | ✅/❌ |

**All ✅?** Type "@ship" to commit and push.
**Any ❌?** Fix first, then "@verify" again.

**⛔ Любой ❌ = ИСПРАВИТЬ. НЕ ПЕРЕХОДИТЬ К @ship.**

---

## GATE 4: @ship

**Коммит + Push + Подтверждение.**

### Execute:
```bash
git add -A
git commit -m "[type]: [description]"
git push
```

### Output Format:

```markdown
## SHIP REPORT

✅ Committed: [commit hash]
✅ Pushed to: origin/[branch]
✅ Files: N files changed

### Verify on GitHub
https://github.com/miklaskoff/clinical-trial-react-app/commit/[hash]

---
**✅ TASK COMPLETE**
```

**⛔ БЕЗ git push = ЗАДАЧА НЕ ЗАВЕРШЕНА**

---

## Legacy Commands (mapped to gates)

| Old Command | Maps to |
|-------------|---------|
| @check | @verify |
| @standards | Part A of @verify |
| @review | Part B of @verify |
| @commit | @ship |
| @fix | Full workflow: @plan → @implement → @verify → @ship |

---

## Quick Reference

| Gate | Command | Blocker | Must Show |
|------|---------|---------|-----------|
| 1 | @plan | User approval | Plan table + Contract |
| 2 | @implement | Tests pass | Test output |
| 3 | @verify | All checks ✅ | Verification tables (A-G) |
| 4 | @ship | git push done | GitHub URL |

---

## Self-Enforcement Rules

**Copilot MUST:**
1. Show ALL tables (A-G) in @verify — not skip any
2. Read lesson learned.md BEFORE implementing (avoid past mistakes)
3. Read copilot-instructions.md BEFORE implementing (follow rules)
4. NOT say "done" until @ship shows GitHub URL
5. Wait for explicit user command between gates
6. Check Implementation Contract if complex feature

**If user says "just do it" or "skip verification":**
- Ask: "Skip verification? This violates workflow. Confirm?"
- If confirmed: note "⚠️ Workflow skipped by user request"
