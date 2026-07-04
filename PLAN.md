# План проекта: Data Room MVP (тестовое задание)

## Блок 1. Боли проекта: что на самом деле проверяет это тестовое

Тестовое написано под конкретную вакансию (Tailored Tech: CRM/ERP на замену 1С, React SPA + NestJS,
фокус 80/20 в сторону фронта). Data Room здесь — прокси-задача: файловый менеджер с деревом папок
структурно повторяет их реальные домены (каталог оборудования, склад, контрагенты — те же иерархии,
CRUD и списки). Ниже — что стоит за каждым пунктом задания.

### 1.1. UX-мышление без макета — главная боль

- В задании приоритеты названы явно и по порядку: **UX и функциональность → дизайн/полировка → код**.
  Код — на третьем месте. Это не «сделай красиво», это «покажи, что умеешь сам спроектировать флоу».
- В вакансии то же самое: «проєктуєш зручний флоу без дизайнера», «бачиш тертя там, де інші його терплять».
  У них нет дизайнера — фронтендер и есть дизайнер.
- Что хотят увидеть: продуманные состояния (пустая папка, загрузка, ошибка), понятная навигация
  (breadcrumbs, вложенность), подтверждения деструктивных действий, отсутствие тупиков.

### 1.2. Edge cases и error states — проверка зрелости

- В задании отдельно подчеркнуто: «handle edge cases and error states», пример — дубликаты имён файлов.
- Боль реального продукта: у них живой продакшн с реальными пользователями. Разработчик, который
  думает только про happy path, дорого обходится.
- Что хотят увидеть: дубликаты имён (файлов и папок), невалидные имена, пустые имена, удаление папки
  с содержимым (каскад + предупреждение), не-PDF файл при загрузке, большой файл, длинные имена.

### 1.3. Структуры данных — проверка инженерного мышления

- «Good data structures to store metadata and state, designed to support functional requirements» —
  прямой намёк: дерево папок нужно смоделировать нормально (adjacency list / parentId), а не хардкодить.
- Это их ежедневная реальность в CRM: иерархичные сущности, связи, состояние списков.
- Что хотят увидеть: чистую модель (nodes с parentId, type, метаданные), каскадное удаление,
  уникальность имени в рамках папки — и чтобы структура объяснялась в README.

### 1.4. Owner-mindset — задание намеренно open-ended

- «The solution method is intentionally left open-ended» + «articulate your decisions»:
  проверяют, как кандидат сам раскладывает неопределённость на решения и обосновывает их.
- В вакансии: «Не чекаєш тікета й макета — береш зону відповідальності й віддаєш зроблене».
- Что хотят увидеть: README с внятными design decisions (почему такой стейт, почему такое хранение,
  какие трейд-оффы), а не просто инструкцию по запуску.

### 1.5. Честность и полировка

- «Don't include unimplemented features» — мёртвые кнопки хуже отсутствующих.
- Что хотят увидеть: маленький, но законченный продукт. Лучше меньше фич, но каждая доведена.

### 1.6. AI-centric workflow

- В задании прямо разрешено «use AI to write code», в вакансии AI — ежедневный инструмент
  («на AI тримається половина того, як ти проєктуєш і пишеш код»).
- Сам процесс (проектирование и сборка через AI-агента) — тоже часть демонстрации. Можно отметить
  workflow в README.

### 1.7. Стек — сигнал совместимости

- «we use React / TypeScript / Tailwind / Shadcn» — использование их стека снимает вопрос адаптации.
  TanStack Query из их стека тоже уместен (даже поверх мокнутого «сервера»).

## Блок 2. Что делаем: состав решения

### Стек и структура (реализовано)

Монорепозиторий: **Bun workspaces + Turborepo** (см. `docs/monorepo.md`).

- **apps/web** — Vite + React 18 + TypeScript, прокси `/api` → `:3000`. Здесь живёт весь Data Room UX.
- **apps/api** — NestJS: реальные CRUD-эндпоинты (датарумы, папки, узлы) на in-memory store,
  бизнес-правила берёт из `@repo/domain`, Swagger UI на `/api/docs`, эмиссия `openapi.json`
  без старта сервера. Хранилище: **PostgreSQL + Drizzle ORM** (см. раздел «База данных» ниже); до этого — in-memory store, осознанно оформленный как репозиторий, поэтому замена локальна.
- **packages/domain** — чистая доменная модель и бизнес-правила (см. ниже), без React/Nest/browser API.
- **packages/contracts** — авторская DTO-поверхность web↔api (DTO-классы api её реализуют).
- **packages/api-client** — **генерируемый** типизированный клиент: api (Nest + swagger) →
  `openapi.json` → Orval → TanStack Query хуки + fetch-мутатор с `ApiError`. Генерат в git не
  коммитится, воспроизводится `bun run generate`; turbo-граф: `api#openapi` →
  `api-client#generate` → `web#build`.
- **packages/ui** — примитивы дизайн-системы (Button, EmptyState), без бизнес-логики.
- **packages/config** — глобальные константы (лимиты загрузки, API prefix).
- **tooling/** — общие конфиги как workspace-пакеты: `@repo/typescript-config`, `@repo/lint-config`,
  `@repo/format-config`, `@repo/tailwind-config` (design-токены `@theme`).
- Качество: turbo task graph (build/typecheck), root ESLint + Prettier — всё зелёное.

Ещё не подключено (следующие шаги): **Tailwind + shadcn/ui**, **роутер** (URL отражает текущую
папку). TanStack Query уже подключён через генерируемые хуки `@repo/api-client`. Решение по данным
изменилось дважды: Dexie/IndexedDB → реальный API с in-memory store → **PostgreSQL + Drizzle ORM** (см. раздел «База данных»);
PDF-блобы — bytea в Postgres (таблица `file_blobs`), добавим на этапе файлов.

### Модель данных (реализована в `@repo/domain`)

```ts
// одна таблица узлов (adjacency list)
type DataroomNode = FolderNode | FileNode; // общее: id, dataroomId, parentId (null = корень),
// name, createdAt, updatedAt; FileNode добавляет size
interface Dataroom {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}
```

Правила уже в `@repo/domain` как чистые функции: `validateNodeName` (пустые/длинные/запрещённые
символы), `isNameTaken` + `nextAvailableName` («file (1).pdf», case-insensitive),
`sortNodes` (папки сверху, по имени), `collectSubtreeIds` (каскадное удаление / подсчёт).
Хранение PDF-блобов — таблица `file_blobs` (bytea) в Postgres, добавим на этапе файлов.

### База данных: PostgreSQL + Drizzle ORM (план внедрения)

Решение обновлено: заменяем in-memory store на настоящий **PostgreSQL** через **Drizzle ORM**.
Мотивация: production-мышление (persistence, миграции, транзакции), снятие трейд-оффа
«не переживает рестарт сервера», близость к реальному стеку CRM/ERP из вакансии.

**Версии (последние на момент решения, 2026-07-04, проверены по npm registry):**

- `drizzle-orm` **0.45.2** — runtime, dependency apps/api;
- `drizzle-kit` **0.31.10** — devDependency: генерация/применение миграций, studio;
- `pg` **8.22.0** (+ `@types/pg`) — драйвер node-postgres; Nest запускается под Node,
  поэтому используем адаптер `drizzle-orm/node-postgres`;
- PostgreSQL **17** — docker image `postgres:17-alpine`.

**Локальная инфраструктура:**

- `docker-compose.yml` в корне репо: сервис `postgres` (порт 5432, named volume для данных,
  healthcheck `pg_isready`), креды dev-уровня `dataroom/dataroom`, БД `dataroom`.
- `.env.example` (коммитится) и `.env` (в .gitignore, уже есть):
  `DATABASE_URL=postgres://dataroom:dataroom@localhost:5432/dataroom`.
- README-путь запуска: `docker compose up -d` → `bun install` → `bun run dev`
  (миграции применяются на старте api сами — см. ниже; принцип works out of the box).

**Размещение кода — внутри `apps/api` (БД нужна только api, отдельный пакет — оверкил):**

- `apps/api/drizzle.config.ts` — конфиг drizzle-kit: `dialect: 'postgresql'`,
  `schema: './src/db/schema.ts'`, `out: './src/db/migrations'`, `dbCredentials.url` из env.
- `apps/api/src/db/schema.ts` — схема таблиц, единственный источник правды.
- `apps/api/src/db/client.ts` — pg `Pool` + `drizzle(pool)`.
- `apps/api/src/db/migrations/` — сгенерированный SQL, **коммитится в git**.
- Nest: `DbModule` отдаёт drizzle-инстанс через DI-токен `DRIZZLE`;
  `onApplicationShutdown` закрывает пул.

**Схема (перенос текущей доменной модели 1:1, adjacency list сохраняется):**

```
datarooms:
  id uuid PK default gen_random_uuid()
  name text NOT NULL
  created_at / updated_at timestamptz NOT NULL
  UNIQUE-индекс по lower(name)            -- имена датарумов уникальны case-insensitive

nodes:
  id uuid PK
  dataroom_id uuid NOT NULL → datarooms.id ON DELETE CASCADE
  parent_id  uuid NULL     → nodes.id     ON DELETE CASCADE   -- NULL = корень
  type text NOT NULL CHECK ('folder' | 'file')
  name text NOT NULL
  size bigint NULL                                            -- только у файлов
  created_at / updated_at timestamptz NOT NULL
  UNIQUE (dataroom_id, parent_id, lower(name)) NULLS NOT DISTINCT
    -- NULLS NOT DISTINCT (Postgres 15+): иначе два "Docs" в корне (parent_id NULL)
    -- не считались бы дубликатами
  индексы: (dataroom_id), (parent_id)

file_blobs (добавим на этапе файлов):
  node_id uuid PK → nodes.id ON DELETE CASCADE
  content bytea NOT NULL, content_type text
    -- отдельная таблица, чтобы листинги узлов не таскали блобы
```

Timestamps: в домене сейчас `number` (epoch ms). БД хранит `timestamptz`; маппим на границе
репозитория (timestamptz ↔ ms), домен и DTO не меняются.

**Слой доступа к данным:**

- `DataroomsService` сохраняет доменные правила из `@repo/domain` (`validateNodeName`,
  `isNameTaken`, `collectSubtreeIds`, `sortNodes`), но вместо `Map` ходит в
  `DataroomsRepository` — тонкую обёртку над drizzle (без бизнес-логики).
- Проверки уникальности остаются в сервисе (читаемые 409), UNIQUE-индексы в БД — страховка
  от гонок: ловим ошибку `23505` и конвертируем в тот же `ConflictException`.
- Каскадное удаление — в транзакции: загружаем узлы датарума, считаем поддерево доменной
  `collectSubtreeIds` (нужно вернуть подсчёт для UI), удаляем корень поддерева —
  `ON DELETE CASCADE` доудаляет остальное. Датарумы маленькие, recursive CTE не нужен.
- Интерфейс сервиса и контроллеры **не меняются** → `openapi.json` не меняется →
  генерат Orval и фронт не трогаем вообще.

**Миграции:**

- `bun run db:generate` → `drizzle-kit generate` (SQL-файлы в `src/db/migrations`, в git).
- `bun run db:migrate` → `drizzle-kit migrate` (ручное применение).
- Плюс programmatic `migrate()` (`drizzle-orm/node-postgres/migrator`) на старте api:
  поднял docker + `bun run dev` — и всё работает без отдельного шага.
- `bun run db:studio` → drizzle-kit studio для просмотра данных.

**Turbo:** новых узлов в task-графе нет (миграции — runtime-операция, не build);
`db:*` — скрипты apps/api, при желании проксируем из корневого package.json.

**Влияние на деплой:** для hosted-версии нужен managed Postgres (Neon free tier — тот же
`DATABASE_URL`). NestJS на Vercel serverless — спорно; вероятный вариант: web на Vercel,
api+Postgres на Railway/Render/Fly. Зафиксируем на этапе деплоя.

**Влияние на SPEC.md:** durable storage переезжает из non-goals (фаза «Гипотетическое
развитие») в scope MVP; трейд-офф «переживает refresh, но не рестарт» снимается.
SPEC.md обновляем синхронно с этим планом.

**Порядок внедрения (~45–60 мин, добавляется к тайм-боксу):**

1. `docker-compose.yml` + `.env.example` + заметка в README.
2. Зависимости apps/api: `drizzle-orm@0.45.2`, `pg@8.22.0`; dev: `drizzle-kit@0.31.10`, `@types/pg`.
3. `drizzle.config.ts` + `src/db/schema.ts` + `client.ts` + `DbModule`.
4. Первая миграция (`db:generate`), programmatic migrate на старте.
5. `DataroomsRepository` + перевод `DataroomsService` с Map на репозиторий.
6. Прогон: `bun run build` / `typecheck`, смоук через Swagger (create/list/rename/delete, каскад),
   рестарт api — данные на месте.

### Функционал (обязательный)

1. Датарумы: создание, список, открытие (топ-уровень «диска»).
2. Папки: создать, вложить, переименовать (inline/dialog), удалить с каскадом и подтверждением
   («будет удалено N папок и M файлов»).
3. Файлы: загрузка только PDF (drag&drop + кнопка), просмотр в UI (iframe/object URL), переименование, удаление.
4. Навигация: breadcrumbs, вход в папку, URL-состояние, пустые состояния с CTA.

### Edge cases (чек-лист)

- Дубликат имени файла/папки в одной папке.
- Пустое/пробельное имя, ограничение длины.
- Не-PDF при загрузке (по MIME и расширению) — внятная ошибка.
- Удаление непустой папки — предупреждение с подсчётом содержимого.
- Переименование в существующее имя.
- Множественная загрузка файлов, частичные ошибки.
- Обновление страницы и рестарт сервера — данные в PostgreSQL, переживают и то и другое;
  прежний трейд-офф in-memory снят.

### Полировка (в рамках тайм-бокса)

- Тосты на операции, скелетоны/спиннеры, aria-атрибуты от shadcn.
- Контекстное меню на строке (rename/delete), сортировка «папки сверху, по имени».

### Extra credit (только если останется время)

- Деплой на Vercel (дёшево, делаем почти всегда).
- Поиск по имени в пределах датарума.
- Auth и blob storage — скорее всего скипаем, отметим в README как «out of scope».

## Блок 3. Порядок работы (тайм-бокс ~5–6 ч + ~1 ч на БД)

1. ✅ **Скелет** — сделано шире плана: монорепа Bun + Turborepo, apps/web + apps/api,
   packages (domain/contracts/ui/config), tooling-конфиги, lint/format, docs.
   Осталось из скелета: Tailwind + shadcn в apps/web, роутер.
2. ✅ **Data layer (API + клиент)** — реальный NestJS CRUD поверх правил `@repo/domain`
   и генерируемый типизированный клиент (swagger → openapi.json → Orval → TanStack Query
   хуки). Смоук-экран в web уже ходит через них. Внедрение Orval сверено с официальным
   гайдом — соответствует.
3. **PostgreSQL + Drizzle ORM** (~45–60 мин): docker-compose, схема, миграции,
   `DataroomsRepository` вместо in-memory Map — детальный план в разделе
   «База данных» выше. API-контракт не меняется.
4. **CRUD папок + навигация** (~1–1.5 ч): дерево, breadcrumbs, create/rename/delete с каскадом.
5. **Файлы** (~1–1.5 ч): upload (валидация PDF), блобы в `file_blobs` (bytea), просмотр,
   rename/delete.
6. **Edge cases + полировка** (~1 ч): чек-лист выше, пустые состояния, тосты.
7. **README + деплой** (~30–45 мин): design decisions, setup (docker compose + автомиграции),
   web на Vercel; api + Postgres — Railway/Render/Neon (решим на месте).

## Блок 4. Deliverables

- Репозиторий с кодом и README (design decisions + setup).
- Hosted URL (Vercel) — рекомендован в задании.
