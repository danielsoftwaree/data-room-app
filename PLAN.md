# План проекта: Data Room MVP (тестовое задание)

## Блок 1. Что на самом деле проверяет это тестовое

Тестовое написано под конкретную вакансию (Tailored Tech: CRM/ERP на замену 1С, React SPA + NestJS,
фокус 80/20 в сторону фронта). Data Room здесь — прокси-задача: файловый менеджер с деревом папок
структурно повторяет их реальные домены (каталог оборудования, склад, контрагенты — те же иерархии,
CRUD и списки). Ниже — что стоит за каждым пунктом задания и что мы показываем в ответ.

### 1.1. UX-мышление без макета

- Приоритеты в задании названы явно и по порядку: **UX и функциональность → дизайн/полировка → код**.
  Это не «сделай красиво», это «покажи, что умеешь сам спроектировать флоу».
- В вакансии то же самое: «проєктуєш зручний флоу без дизайнера», «бачиш тертя там, де інші його
  терплять». У них нет дизайнера — фронтендер и есть дизайнер.
- Показываем: продуманные состояния (пустая папка, загрузка, ошибка), понятная навигация
  (breadcrumbs, вложенность), подтверждения деструктивных действий, отсутствие тупиков.

### 1.2. Edge cases и error states — проверка зрелости

- В задании отдельно подчёркнуто: «handle edge cases and error states», пример — дубликаты имён файлов.
- Показываем: дубликаты имён (файлов и папок), невалидные/пустые/длинные имена, удаление папки
  с содержимым (каскад + предупреждение с подсчётом), не-PDF при загрузке, частичные ошибки
  множественной загрузки.

### 1.3. Структуры данных — проверка инженерного мышления

- «Good data structures to store metadata and state, designed to support functional requirements» —
  дерево папок моделируем нормально (adjacency list / parentId), правила — как чистые функции.
- Показываем: чистую модель (nodes с parentId, type, метаданные), каскадное удаление, уникальность
  имени в рамках папки — и объяснение структуры в README.

### 1.4. Owner-mindset — задание намеренно open-ended

- «The solution method is intentionally left open-ended» + «articulate your decisions»: проверяют,
  как кандидат сам раскладывает неопределённость на решения и обосновывает их.
- Показываем: README с внятными design decisions (почему такой стейт, почему такое хранение,
  какие трейд-оффы), а не просто инструкцию по запуску.

### 1.5. Честность и полировка

- «Don't include unimplemented features» — мёртвые кнопки хуже отсутствующих.
- Показываем: законченный продукт, где каждая фича доведена до конца.

### 1.6. AI-centric workflow

- В задании прямо разрешено «use AI to write code», в вакансии AI — ежедневный инструмент
  («на AI тримається половина того, як ти проєктуєш і пишеш код»). Сам процесс (проектирование
  и сборка через AI-агента) — часть демонстрации; отметим workflow в README.

### 1.7. Стек

- «we use React / TypeScript / Tailwind / Shadcn» — проект собран ровно на этом стеке
  (+ TanStack Query из вакансии); вопрос совместимости закрыт фундаментом.

## Блок 2. Что делаем: состав решения

### Фундамент (готово; `build` / `typecheck` / `lint` / `format:check` — зелёные)

- Монорепа **Bun workspaces + Turborepo**: `apps/web` (Vite 8 + React 19 + TypeScript 6),
  `apps/api` (NestJS 11, Swagger UI на `/api/docs`),
  `packages/{domain,contracts,api-client,ui,config}`, `tooling/*` (TS/lint/format/tailwind
  конфиги как workspace-пакеты). Границы и направления зависимостей — `docs/monorepo.md`.
- Типизированный API-пайплайн без ручной синхронизации: Nest (swagger) → `openapi.json` → Orval →
  TanStack Query хуки + fetch-мутатор с `ApiError` (`bun run generate`); генерат в git не коммитится;
  turbo-граф: `api#openapi` → `api-client#generate` → `web#build`.
- `@repo/domain` — чистая доменная модель и бизнес-правила: `validateNodeName`
  (пустые/длинные/запрещённые символы), `isNameTaken` + `nextAvailableName` («file (1).pdf»,
  case-insensitive), `sortNodes` (папки сверху, по имени), `collectSubtreeIds`
  (каскад/подсчёт). Без React/Nest/browser API.
- `apps/api` — реальный CRUD датарумов/папок/узлов поверх доменных правил; store оформлен как
  репозиторий, поэтому переход на Postgres локален и не трогает контроллеры и контракт.
- Дизайн-система: **Tailwind v4 + shadcn/ui** в `packages/ui` (button, input, label, card, dialog,
  alert-dialog, dropdown-menu, breadcrumb, tooltip, separator, skeleton, empty-state; `cn()`;
  subpath-экспорты `@repo/ui/components/*`), дизайн-токены в `tooling/tailwind-config/theme.css`
  (light + dark, `@theme inline`).
- Оба приложения разложены на вертикальные модули: `apps/api/src/modules/*`,
  `apps/web/src/{app,features,shared}` (правила — в README внутри этих директорий).

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

### База данных: PostgreSQL + Drizzle ORM

Persistence по-настоящему: **PostgreSQL** через **Drizzle ORM** — production-мышление
(миграции, транзакции, уникальные индексы как страховка от гонок) и тот же класс стека,
что в реальном CRM/ERP из вакансии.

**Версии (проверены по npm registry, 2026-07-04):**

- `drizzle-orm` **0.45.2** — runtime, dependency `packages/db`;
- `drizzle-kit` **0.31.10** — devDependency: генерация/применение миграций, studio;
- `pg` **8.22.0** (+ `@types/pg`) — драйвер node-postgres; Nest запускается под Node,
  поэтому используем адаптер `drizzle-orm/node-postgres`;
- PostgreSQL **17** — docker image `postgres:17-alpine`.

**Локальная инфраструктура:**

- `docker-compose.yml` в корне репо: сервис `postgres` (порт 5432, named volume для данных,
  healthcheck `pg_isready`), креды dev-уровня `dataroom/dataroom`, БД `dataroom`.
- `.env.example` (коммитится) и `.env` (в .gitignore):
  `DATABASE_URL=postgres://dataroom:dataroom@localhost:5432/dataroom`.
- README-путь запуска: `docker compose up -d` → `bun install` →
  `bun run --cwd packages/db db:migrate` → `bun run dev`.

**Размещение кода — общий DB package + Nest wiring в api:**

- `packages/db/drizzle.config.ts` — конфиг drizzle-kit: `dialect: 'postgresql'`,
  `schema: './src/schema.ts'`, `out: './migrations'`, `dbCredentials.url` из env.
- `packages/db/src/schema.ts` — схема таблиц, единственный источник правды.
- `packages/db/migrations/` — сгенерированный SQL, **коммитится в git**.
- `apps/api/src/config/env/*` — zod-валидируемый env-модуль с безопасными dev-defaults,
  fail-fast ошибками для невалидных значений и типизированным `EnvService`.
- `apps/api/src/config/database/*` — Nest DI (`DatabaseModule`), который получает pg `Pool`
  и drizzle instance из `createDatabase()` пакета `@repo/db`, плюс `onApplicationShutdown`.
- `apps/api/src/shared/*` — общие backend helpers/errors/types/test-utils, не привязанные
  к конкретному feature module.

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
  UNIQUE partial index (dataroom_id, lower(name)) WHERE parent_id IS NULL
  UNIQUE partial index (dataroom_id, parent_id, lower(name)) WHERE parent_id IS NOT NULL
    -- два индекса читаются проще, чем NULLS NOT DISTINCT, и так же закрывают дубликаты
  индексы: (dataroom_id), (parent_id)

file_blobs:
  node_id uuid PK → nodes.id ON DELETE CASCADE
  content bytea NOT NULL, content_type text
    -- отдельная таблица, чтобы листинги узлов не таскали блобы
```

Timestamps: в домене `number` (epoch ms). БД хранит `timestamptz`; маппим на границе
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
- OpenAPI остаётся источником правды: новые endpoints файлов (`POST /datarooms/:id/files`,
  `GET /nodes/:id/content`) добавляются через DTO/Swagger → `bun run generate` → Orval.

**Файловый upload и лимиты:**

- Файлы сохраняются на backend: metadata в `nodes`, bytes — за абстракцией `BlobStorage`
  (`apps/api/src/modules/storage`): `STORAGE_DRIVER=db` кладёт их в `file_blobs.content`
  (`bytea`, zero-setup для локальной разработки), `STORAGE_DRIVER=s3` — в любой
  S3-совместимый bucket (Railway) через `@aws-sdk/client-s3`. Ключ блоба = id узла;
  при сбое записи блоба metadata-строка компенсационно удаляется.
- MVP принимает только PDF, потому что задание явно разрешает начать с PDF и UI умеет
  показать PDF без дополнительного preview-пайплайна. Быстро расширяемо: images (`png/jpg`)
  можно добавить почти сразу, office-документы — только как download, preview уже отдельная задача.
- Лимит — `UPLOAD.maxFileSizeBytes` из `@repo/config` (`50 MB`). Сервер проверяет MIME,
  расширение и PDF-сигнатуру `%PDF-`; файлы больше лимита отклоняются, гигабайты не принимаем.
- При 10 rps обычных CRUD-запросов хватит текущего pg pool (`DATABASE_POOL_MAX`, default 10).
  50–100 rps metadata-запросов переживаются через pool/очередь БД; лишний трафик срезает
  глобальный per-IP rate limit (`@nestjs/throttler`, 100 req/min). Больные — одновременные
  большие upload: multer держит файл в памяти (до 50 MB на запрос), поэтому десятки
  параллельных загрузок упираются в RAM; следующий шаг для Railway+S3 — presigned upload
  напрямую в bucket, чтобы байты вообще не шли через API.

**Миграции:**

- `bun run --cwd packages/db db:generate` → `drizzle-kit generate`
  (SQL-файлы в `packages/db/migrations`, в git).
- `bun run --cwd packages/db db:migrate` → `runMigrations()` из `@repo/db`
  (ручное применение до старта API; bootstrap приложения миграции не запускает).
- `bun run --cwd packages/db db:studio` → drizzle-kit studio для просмотра данных.

**Turbo:** новых узлов в task-графе нет (миграции — deploy/runtime-операция, не build);
`db:*` — скрипты `packages/db`; `apps/api` не дублирует прокси-скрипты.

**HTTP hardening (реализовано):** глобальный `ApiExceptionFilter` приводит все ошибки
к контракту `{ error: { code, message } }` (неизвестные — непрозрачный 500 + лог),
`helmet`, CORS-allowlist через `CORS_ORIGIN` (обязателен в production), `PORT` из env
(Railway инжектит сам), rate limit 100 req/min. `DATABASE_URL` обязателен в production —
тихий fallback остаётся только в dev.

**Тесты (bun test, 55 зелёных):** unit `@repo/domain` (18), unit `DataroomsService` поверх
in-memory фейков репозитория и стораджа (20), unit `ApiExceptionFilter` (3), HTTP integration (14) —
реальное Nest-приложение (контроллеры, ValidationPipe, multipart, фильтр) с подменой только
PG/S3 на фейки, поэтому сьют не требует поднятой базы. Нюанс bun: транспайлер не эмитит
классы в `design:paramtypes`, поэтому class-typed параметры конструкторов помечены явным
`@Inject(...)`.

**SPEC.md** обновляем синхронно: durable storage — в scope MVP.

**Порядок внедрения:**

1. `docker-compose.yml` + `.env.example` + заметка в README.
2. Зависимости: `packages/db` владеет `drizzle-orm@0.45.2`, `pg@8.22.0`,
   `@types/pg` + `drizzle-kit@0.31.10`; `apps/api` владеет только Nest wiring.
3. `packages/db/drizzle.config.ts` + `packages/db/src/schema.ts` +
   `apps/api/src/config/database/DatabaseModule`.
4. Первая миграция (`db:generate`), явный `bun run --cwd packages/db db:migrate`.
5. `DataroomsRepository` + перевод `DataroomsService` с Map на репозиторий.
6. Прогон: `bun run build` / `typecheck`, смоук через Swagger (create/list/rename/delete/upload/content, каскад),
   рестарт api — данные на месте.

### Функционал (обязательный)

1. Датарумы: создание, список, открытие (топ-уровень «диска»).
2. Папки: создать, вложить, переименовать (inline/dialog), удалить с каскадом и подтверждением
   («будет удалено N папок и M файлов»).
3. Файлы: загрузка только PDF (drag&drop + кнопка), просмотр в UI (iframe/object URL),
   переименование, удаление.
4. Навигация: breadcrumbs, вход в папку, URL-состояние, пустые состояния с CTA.

### Edge cases (чек-лист)

- Дубликат имени файла/папки в одной папке.
- Пустое/пробельное имя, ограничение длины.
- Не-PDF при загрузке (по MIME и расширению) — внятная ошибка.
- Удаление непустой папки — предупреждение с подсчётом содержимого.
- Переименование в существующее имя.
- Множественная загрузка файлов, частичные ошибки.
- Обновление страницы и рестарт сервера — данные в PostgreSQL.

### Полировка

- Тосты на операции, скелетоны/спиннеры, aria-атрибуты и фокус-менеджмент от shadcn.
- Контекстное меню на строке (rename/delete), сортировка «папки сверху, по имени».
- Переключатель светлой/тёмной темы — токены обеих тем уже готовы в `theme.css`.

### Дифференциаторы (в скоупе: жёсткого тайм-бокса нет)

- **Auth (Clerk)** — фундамент заложен (зависимости `@clerk/clerk-react` / `@clerk/backend`,
  env-переменные, план в `docs/auth-clerk.md`): sign-in/sign-up, защита API, датарумы приватны
  для пользователя.
- **Поиск** по имени в пределах датарума.
- **Деплой**: всё на Railway — web, api, PostgreSQL и S3-совместимый bucket (файлы).
  Для api задать `DATABASE_URL`, `CORS_ORIGIN`, `STORAGE_DRIVER=s3` + `S3_*`; `PORT` Railway
  инжектит сам. Docker для локальной разработки не обязателен (нужен только PostgreSQL;
  блобы при `STORAGE_DRIVER=db` живут в той же базе). Hosted URL — в README.

## Блок 3. Порядок работы

Каждый шаг оставляет репозиторий в зелёном состоянии (`build` / `typecheck` / `lint`).

1. ✅ **Скелет** — монорепа Bun + Turborepo, apps/web + apps/api, packages
   (domain/contracts/ui/config), tooling-конфиги, lint/format, docs, Tailwind v4 + shadcn/ui.
2. ✅ **Data layer (API + клиент)** — NestJS CRUD поверх правил `@repo/domain` и генерируемый
   типизированный клиент (swagger → openapi.json → Orval → TanStack Query хуки).
3. ✅ **PostgreSQL + Drizzle ORM** — durable storage вместо `Map`; миграции отдельной
   командой `packages/db` до старта API.
4. **Роутер + навигация** — URL отражает текущую папку, breadcrumbs, вход в папку,
   пустые состояния с CTA.
5. **CRUD папок** — create/rename/delete с каскадом и подтверждением
   («будет удалено N папок и M файлов»).
6. ✅ (backend) **Файлы** — upload только PDF (MIME + расширение + `%PDF-`, лимит 50 MB),
   блобы за `BlobStorage` (db/s3), binary content endpoint, hardening (фильтр ошибок, helmet,
   CORS, throttler) и 55 тестов; UI для drag&drop/preview ещё впереди.
7. **Edge cases + полировка** — чек-лист блока 2, тосты, скелетоны, тема.
8. **Auth (Clerk)** — по `docs/auth-clerk.md`.
9. **Поиск** в пределах датарума.
10. **README + деплой** — design decisions, setup (docker compose + явные миграции), hosted URL.

## Блок 4. Deliverables

- Репозиторий: код + README (design decisions, setup «docker compose up -d → bun install →
  bun run dev», AI-workflow).
- Hosted URL (рекомендован в задании): web на Vercel, api + Postgres на managed-хостинге.
- Зелёные `bun run build` / `typecheck` / `lint` / `format:check`.
