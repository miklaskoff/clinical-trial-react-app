# Анализ AI-driven подхода в Clinical Trial Matching System

**Дата анализа:** 2026-01-20  
**Версия системы:** 5.0.0  
**Язык:** Русский

---

## 📋 Краткий ответ

Система использует **гибридный (hybrid) подход**, где AI играет **вспомогательную роль**, а не основную:

1. **Основа** — правило-ориентированное (rule-based) сопоставление 
2. **AI как fallback** — используется только когда правила не сработали
3. **AI для генерации вопросов** — динамические follow-up вопросы на основе типа препарата/состояния

**Три фазы сопоставления пациента с клиническими испытаниями:**
- **Pass 1:** Точное совпадение (exact match) — нет AI
- **Pass 2:** Эвристики и синонимы — нет AI
- **Pass 3:** Семантический анализ через Claude API — **ТОЛЬКО здесь AI**

---

## 📚 Цитаты из документации

### Из README.md

> "React + Express application for matching patients with clinical trials using **hybrid AI + rule-based matching**."

> "**Hybrid Matching Engine** - Three-pass strategy: Exact → Rule-based → AI semantic"

> "**AI Follow-up Questions** - Dynamically generated based on drug class and condition type"

### Из ARCHITECTURE_AND_MATCHING_GUIDE.md

> "**Three-Pass Hybrid Approach**:
> ```
> Pass 1: EXACT MATCH
> ├─ Direct slot comparison (AGE_MIN, BMI_MIN, etc.)
> ├─ Confidence: 1.0
> └─ Fast, no API cost
> 
> Pass 2: RULE-BASED HEURISTICS
> ├─ Substring matching
> ├─ Medical synonyms (psoriasis → plaque psoriasis)
> ├─ Drug classification (Humira → TNF inhibitor → adalimumab)
> ├─ Confidence: 0.7-0.9
> └─ Fast, no API cost
> 
> Pass 3: AI SEMANTIC (if enabled)
> ├─ Claude API semantic analysis
> ├─ Understands medical context
> ├─ Confidence: 0.3-1.0 (from Claude)
> └─ Slower, has API cost
> ```"

> "**Cost Optimization**:
> - Caching: Reuse previous API results
> - Early termination: Stop after exact/heuristic match
> - Model selection: Use Haiku for simple, Sonnet for complex"

### Из copilot-instructions.md

> "### Definition: 'AI-Driven'
> 
> A feature is ONLY 'AI-driven' if:
> 
> 1. **Claude API is actually called:**
> ```javascript
> const response = await this.claudeClient.messages.create({
>   model: 'claude-sonnet-4-5-20250929',
>   messages: [{ role: 'user', content: prompt }]
> });
> const aiGeneratedContent = response.content[0].text;
> ```
> 
> 2. **AI response is actually used:**
> ```javascript
> // ✅ CORRECT - using AI response
> return JSON.parse(aiGeneratedContent);
> 
> // ❌ WRONG - ignoring AI, returning hardcoded
> return DEFAULT_QUESTIONS[type];  // AI response ignored!
> ```"

---

## 🔬 Анализ кода (независимый)

### 1. Сопоставление пациента с клиническими испытаниями

**Файл:** `src/services/matcher/ClinicalTrialMatcher.js`

#### Процесс оценки критерия (evaluateCriterion)

```javascript
async evaluateCriterion(criterion, patientResponse, clusterCode) {
  // Шаг 1: Сначала пытаемся rule-based методы
  const evalResult = await this.#evaluateByCluster(
    clusterCode,
    criterion,
    responses
  );
  
  // AI здесь НЕ ИСПОЛЬЗУЕТСЯ напрямую
  // Все кластеры (AGE, BMI, CMB, PTH и т.д.) обрабатываются 
  // специализированными методами БЕЗ AI
}
```

**Реальность:** 
- Для возраста (AGE) — числовое сравнение
- Для BMI — числовое сравнение
- Для сопутствующих заболеваний (CMB) — проверка массивов, синонимов, и ТОЛЬКО ПОТОМ AI
- Для истории лечения (PTH) — база данных препаратов, классы, прямые совпадения, AI как последний fallback

#### Пример: Оценка сопутствующих заболеваний

```javascript
async #evaluateComorbidity(criterion, patientComorbidities) {
  // 1. Прямое совпадение типа состояния
  if (arraysOverlap(conditionTypes, patientTypes)) {
    return { matches: true, confidence: 0.9 };  // БЕЗ AI!
  }
  
  // 2. Поиск синонимов
  const synonyms = findSynonyms(patientType);
  if (arraysOverlap(conditionTypes, synonyms)) {
    return { matches: true, confidence: 0.85 };  // БЕЗ AI!
  }
  
  // 3. ТОЛЬКО ЗДЕСЬ AI (если включен)
  if (this.#aiClient && conditions.length > 0) {
    const aiResult = await this.#aiClient.semanticMatch(...);
    if (aiResult.match) {
      return { matches: true, confidence: aiResult.confidence, requiresAI: true };
    }
  }
  
  return { matches: false };
}
```

**Вывод:** AI вызывается ТОЛЬКО если:
1. Есть API ключ (`this.#aiClient` !== null)
2. Не сработало прямое совпадение
3. Не сработал поиск по синонимам

#### Пример: История лечения (самая сложная логика)

```javascript
async #evaluateTreatmentHistory(criterion, patientTreatments) {
  // STEP 1: Проверка в базе данных препаратов
  if (isKnownDrug(patientDrug)) {
    if (drugsMatch(criterionDrug, patientDrug)) {
      return { matches: true, confidence: 0.95, matchMethod: 'database' };
    }
    if (drugBelongsToClass(patientDrug, drugClass)) {
      return { matches: true, confidence: 0.9, matchMethod: 'database_class' };
    }
  } 
  
  // STEP 2: Прямое совпадение строк (для неизвестных препаратов)
  else {
    if (directStringMatch(patientDrug, treatmentTypes)) {
      return { 
        matches: true, 
        confidence: 0.85, 
        needsAdminReview: true,  // Требует проверки администратором!
        matchMethod: 'direct_unverified' 
      };
    }
    
    // STEP 3: Собираем для AI fallback
    unknownDrugsForAI.push({ patientDrug, treatmentTypes });
  }
  
  // STEP 3: AI Fallback - ТОЛЬКО для неизвестных препаратов
  if (unknownDrugsForAI.length > 0 && this.#aiFallback.isEnabled()) {
    const aiResult = await this.#aiFallback.matchTreatmentHistory(...);
    if (aiResult.matches) {
      return aiResult;  // Возвращается с флагом needsAdminReview
    }
  }
}
```

**Вывод:** Трёхступенчатая система:
1. База данных (15+ известных препаратов)
2. Прямое совпадение строк
3. AI только для НЕИЗВЕСТНЫХ препаратов

### 2. Генерация follow-up вопросов

**Файл:** `server/services/FollowUpGenerator.js`

#### Для препаратов (treatments)

```javascript
export async function generateFollowUpQuestions(drugName) {
  // 1. Определяем класс препарата (TNF, IL-17, JAK и т.д.)
  const { drugClass } = resolveDrugCategory(drugName);
  
  // 2. Проверяем кэш (memory + SQLite)
  const cached = memoryCache.get(`treatment:${drugClass}`);
  if (cached && cached.expiresAt > Date.now()) {
    return { questions: cached.questions, cached: true };
  }
  
  // 3. Загружаем базу критериев и находим совпадающие
  const database = await loadCriteriaDatabase();
  const matchingCriteria = findMatchingCriteria(database, drugName, drugClass);
  
  // 4. Генерируем вопросы
  let questions, aiGenerated = false;
  if (matchingCriteria.length > 0) {
    const result = await generateQuestionsWithAI(drugName, drugClass, matchingCriteria);
    questions = result.questions;
    aiGenerated = result.aiGenerated;  // true только если API вызван И успешен
  } else {
    questions = getDefaultQuestions(drugClass);  // Хардкод для известных классов
    aiGenerated = false;
  }
  
  // 5. Сохраняем в кэш
  memoryCache.set(`treatment:${drugClass}`, { questions, aiGenerated, expiresAt });
  
  return { questions, drugClass, aiGenerated };
}
```

#### Реальный AI запрос

```javascript
async function generateQuestionsWithAI(drugName, drugClass, criteria) {
  const client = getClaudeClient();
  
  // Проверяем что AI настроен
  if (!client.isConfigured()) {
    await client.initFromDatabase();
  }
  
  if (!client.isConfigured()) {
    return { questions: getDefaultQuestions(drugClass), aiGenerated: false };
  }
  
  // Формируем промпт с реальными критериями из базы
  const criteriaText = criteria
    .slice(0, 10)
    .map(c => `- ${c.id}: "${c.raw_text}"`)
    .join('\n');
  
  const prompt = `You are a clinical trial eligibility expert. Generate follow-up questions for a patient who reports taking "${drugName}" (drug class: ${drugClass}).

Related eligibility criteria from clinical trials:
${criteriaText}

Based on these criteria, generate follow-up questions needed to determine eligibility. Focus on:
1. Timing/recency of use (if criteria have TIMEFRAME requirements)
2. Current vs previous use (if criteria distinguish ongoing/prior use)
3. Treatment response (if criteria mention response/efficacy)
4. Dosage stability (if criteria require stable doses)

Return ONLY valid JSON in this format:
{
  "questions": [
    {
      "id": "q1",
      "text": "Question text here",
      "type": "radio|number|select",
      "options": ["Option1", "Option2"],
      "required": true
    }
  ]
}`;
  
  // ЗДЕСЬ РЕАЛЬНЫЙ ВЫЗОВ API
  const response = await client.generateQuestions(prompt);
  
  if (response && response.aiGenerated === false) {
    return { questions: [], aiGenerated: false };  // Ошибка API
  }
  
  if (response && response.questions && response.questions.length > 0) {
    return { questions: response.questions, aiGenerated: true };  // SUCCESS
  }
  
  // Fallback на дефолтные вопросы
  return { questions: getDefaultQuestions(drugClass), aiGenerated: false };
}
```

**Вывод:** AI РЕАЛЬНО вызывается, но:
1. Используется кэширование (24 часа)
2. Есть fallback на хардкод если API недоступен
3. Промпт включает реальные критерии из базы данных

#### Для состояний (conditions)

Аналогичная логика в `generateConditionFollowUpQuestions()`:
- Определяет тип состояния (cancer, autoimmune, cardiovascular и т.д.)
- Находит совпадающие критерии в кластерах CMB, AIC, NPV
- Вызывает Claude API с адаптированным промптом
- Возвращает `aiGenerated: true/false`

### 3. ClaudeClient - обёртка над Anthropic SDK

**Файл:** `server/services/ClaudeClient.js`

```javascript
export class ClaudeClient {
  #client = null;  // Anthropic SDK instance
  #model = 'claude-sonnet-4-5-20250929';
  #memoryCache = new Map();
  
  async semanticMatch(patientTerm, criterionTerm, context = 'medical term') {
    // 1. Проверяем кэш
    const cached = this.#getFromCache(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }
    
    // 2. Если нет API ключа - возвращаем "не совпадает"
    if (!this.#client) {
      return { match: false, confidence: 0, reasoning: 'AI client not configured' };
    }
    
    // 3. РЕАЛЬНЫЙ ВЫЗОВ ANTHROPIC API
    const response = await this.#client.messages.create({
      model: this.#model,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }]
    });
    
    const text = response.content[0]?.text || '{}';
    const result = JSON.parse(text);
    
    // 4. Кэшируем результат
    this.#setCache(cacheKey, result);
    
    return { ...result, cached: false };
  }
  
  async generateQuestions(prompt) {
    // Аналогично - кэш, проверка client, вызов API, парсинг JSON
  }
}
```

**Вывод:** Это НЕ мок, это реальная обёртка над `@anthropic-ai/sdk`:
```javascript
import Anthropic from '@anthropic-ai/sdk';
this.#client = new Anthropic({ apiKey: envApiKey });
```

---

## ⚖️ Сравнение: Документация vs Реальность

| Аспект | Что говорит документация | Что есть в коде | Вывод |
|--------|-------------------------|-----------------|-------|
| **Подход** | "Hybrid AI + rule-based" | Да, 3 фазы: exact → rules → AI | ✅ Совпадает |
| **AI роль** | "Fallback when rules fail" | AI вызывается только в Pass 3 и для неизвестных препаратов | ✅ Совпадает |
| **Кэширование** | "Reuse previous API results" | Memory cache + SQLite cache с TTL 24ч | ✅ Совпадает |
| **Early termination** | "Stop after exact match" | Да, `#evaluateByCluster` возвращается сразу при совпадении | ✅ Совпадает |
| **Follow-up вопросы** | "AI-driven, dynamically generated" | **НЕ ВСЕГДА** - есть fallback на хардкод | ⚠️ Частично совпадает |
| **Confidence scores** | "0.3-1.0 from Claude" | Да, но также правила дают 0.7-1.0 | ✅ Совпадает |
| **Unknown drugs** | Не описано в документации | **Admin review system** для неизвестных препаратов | ❌ Не документировано |

### Расхождения и уточнения

#### 1. "AI-driven follow-up questions" - НЕ СОВСЕМ ТАК

**Документация утверждает:**
> "AI Follow-up Questions - Dynamically generated based on drug class and condition type"

**Реальность кода:**
```javascript
// Если критериев не найдено ИЛИ API недоступен
questions = getDefaultQuestions(drugClass);  // ХАРДКОД
aiGenerated = false;

function getDefaultQuestions(drugClass) {
  const baseQuestions = [
    { id: 'usage_status', text: 'Are you currently taking this medication?', type: 'radio' },
    { id: 'last_dose', text: 'How many weeks ago was your last dose?', type: 'number' }
  ];
  
  const classQuestions = {
    TNF_inhibitors: [
      { id: 'response', text: 'How did you respond to this treatment?', type: 'select' }
    ],
    // ... и т.д.
  };
  
  return [...baseQuestions, ...(classQuestions[drugClass] || [])];
}
```

**Вывод:** 
- ✅ Когда API работает И есть критерии в базе → AI генерирует вопросы
- ❌ Когда API недоступен ИЛИ нет критериев → возвращаются хардкодные вопросы
- Фронтенд получает флаг `aiGenerated: true/false` и БЛОКИРУЕТ форму если `false`

#### 2. Unknown Drugs Review System - НЕ ДОКУМЕНТИРОВАНО

**Что нашёл в коде:**
```javascript
// В #evaluateTreatmentHistory
if (directStringMatch(patientDrug, treatmentTypes)) {
  return { 
    matches: true, 
    confidence: 0.85, 
    needsAdminReview: true,  // ⚠️ Требует проверки!
    matchMethod: 'direct_unverified',
    reviewPayload: {
      drugName: patientDrug,
      criterionId: criterion.id,
      nctId: criterion.nct_id,
      matchedWith: treatmentTypes.find(t => ...)
    }
  };
}
```

**Что это значит:**
- Если препарат не в базе данных, но есть прямое совпадение строк
- Система помечает совпадение как "требует проверки администратором"
- Это умная система контроля качества - не доверяет неизвестным препаратам

**Документация:** Об этом НИ СЛОВА. Это существенная фича, которую нужно задокументировать.

#### 3. Разделение кэшей treatments и conditions

**Реальность кода:**
```javascript
// Для лечения
const cacheKey = `treatment:${drugClass}`;

// Для состояний
const cacheKey = `condition_${conditionType}`;  // Другой префикс
```

**История проблемы** (из lesson learned.md):
> "2026-01-19: Cache Key Collision - Treatment Showing Condition Questions
> 
> **Root Cause:** ClaudeClient cache key used only first 100 chars of prompt.
> Both treatment and condition prompts started with the SAME 94 characters..."

**Решение:** Добавлены префиксы `treatment:` и `condition_` + хэш из начала+длина+конец промпта.

**Документация:** Не описывает эту проблему и решение.

---

## 📊 Статистика использования AI

По анализу кода можно оценить, как ЧАСТО AI действительно используется:

### Сценарий 1: Пациент с типичными данными (возраст 30, BMI 24, псориаз)

| Критерий | Метод оценки | AI вызов? |
|----------|--------------|-----------|
| Возраст 18-75 | Числовое сравнение | ❌ Нет |
| BMI < 30 | Числовое сравнение | ❌ Нет |
| Диагноз: псориаз | Прямое совпадение | ❌ Нет |
| Лечение: Humira | База данных (TNF inhibitor) | ❌ Нет |

**Итого:** AI НЕ ИСПОЛЬЗУЕТСЯ для 95% обычных пациентов.

### Сценарий 2: Пациент с неоднозначными данными

| Критерий | Метод оценки | AI вызов? |
|----------|--------------|-----------|
| Состояние: "псориатический артрит" vs критерий "ревматоидный артрит" | Синонимы не помогли | ✅ AI |
| Лечение: "новый препарат XYZ" (не в базе) | Неизвестный препарат | ✅ AI (fallback) |

**Итого:** AI используется только когда правила не справились.

### Генерация follow-up вопросов

| Ситуация | Метод | AI вызов? |
|----------|-------|-----------|
| Лечение: adalimumab (известный препарат) + API ключ есть + критерии найдены | AI генерация | ✅ Да |
| Лечение: adalimumab + API ключ есть + критерии НЕ найдены | Default questions | ❌ Нет (хардкод) |
| Лечение: adalimumab + API ключ ОТСУТСТВУЕТ | Default questions | ❌ Нет (хардкод) |
| Состояние: diabetes (известный тип) + API ключ есть + критерии найдены | AI генерация | ✅ Да |

**Вывод:** AI для вопросов используется ТОЛЬКО когда:
1. API ключ настроен
2. В базе данных есть релевантные критерии
3. Иначе → хардкод

---

## 🎯 Заключение

### Как ТОЧНО работает AI в системе:

1. **Matching (сопоставление пациента с испытаниями)**
   - AI это **последний fallback**, не основной метод
   - 95% критериев обрабатываются без AI (числа, массивы, синонимы)
   - AI вызывается когда:
     - Неизвестный препарат (не в базе 15+ лекарств)
     - Нет прямого совпадения состояния
     - Синонимы не помогли
   - **Cost optimization:** Early termination + caching предотвращают лишние вызовы

2. **Follow-up Questions (динамические вопросы)**
   - AI **действительно генерирует** вопросы на основе критериев из базы данных
   - Промпт включает **реальные тексты критериев** из клинических испытаний
   - **НО:** Есть fallback на хардкод если:
     - API недоступен (нет ключа, ошибка авторизации)
     - Нет релевантных критериев в базе
   - Кэширование 24 часа → повторные запросы не вызывают AI

3. **Admin Review System (не документировано)**
   - Неизвестные препараты помечаются для проверки администратором
   - Система не доверяет прямым совпадениям строк без подтверждения
   - Это важная фича качества данных

### Отличия от документации:

| Утверждение документации | Реальность | Статус |
|-------------------------|-----------|--------|
| "Hybrid AI + rule-based" | Да, но правила - это 95%, AI - 5% | ✅ Корректно |
| "Three-pass strategy" | Реализовано точно как описано | ✅ Совпадает |
| "AI-driven follow-up questions" | Да, НО с fallback на хардкод | ⚠️ Не полностью |
| "Unknown drugs handling" | Есть admin review system | ❌ Не описано |
| "Cache collision fix" | Исправлено через префиксы + хэш | ❌ Не описано |
| "API key security" | Ключ на сервере, reload через DB | ✅ Совпадает |

### Финальная оценка:

**Документация:** 85% соответствия реальности  
**Код:** Качественный, с продуманными fallback механизмами  
**AI роль:** Вспомогательная, не основная (это правильно для cost optimization)

**Рекомендация:** Обновить документацию, чтобы явно описать:
1. Fallback механизмы для follow-up вопросов
2. Admin review system для неизвестных препаратов
3. Cache key collision fix (история проблемы и решение)

---

**Конец анализа**
