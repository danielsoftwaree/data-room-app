# Drive-класс фичи: Корзина, Избранное, Owner, Доступы

> План реализации. Прогресс и остаток задач — в `HANDOFF-drive-features.md` (корень репозитория).

## Context

Data Room MVP уже имеет 3-панельный браузер документов, участников с ролями (owner/editor/viewer), owner-колонку, избранное на уровне комнат и активность. Задача — довести функционал до уровня Google Drive: **корзина** (сейчас удаление жёсткое, «cannot be undone»), **полноценное избранное** (звёзды на строках + экран), **доступы** (роли есть, но нигде не проверяются — любой пользователь видит и правит всё), **owner на дашборде**. Инфраструктура (members, favorites API, activity, сид с ролями) уже есть — её нужно углубить до реальных фич.

## Продуктовые решения

1. **Корзина — только для узлов**; удаление комнаты остаётся жёстким (owner-only, confirm). Trash в стиле Drive: в корзину **без confirm**, мгновенно, тост «Moved to trash» + **Undo**. Confirm остаётся для «Delete forever», «Empty trash» и удаления комнаты. Ретеншн («30 days») не обещаем — нет фоновых джоб.
2. **Доступы = членство**: список комнат — только где ты участник; не-участнику — **404** (не палим существование), участнику без прав — **403**. Мутации узлов — editor+; участники и rename/delete комнаты — owner-only; viewer — read-only (+избранное). Guard «последнего owner». Смена роли — новый `PATCH` (сейчас костыль через POST-upsert; POST станет 409 для существующего участника).
3. **Избранное**: hover-звезда на строках/гриде, в DetailPanel/кебабах, звезда на комнатах дашборда, экран `/favorites`, переход к файлу через `?select=<nodeId>` (предвыбор + скролл). UI-название — «Favorites».
4. **Owner на дашборде**: `DataroomDto` + `myRole`, `memberCount`, `owner` → строка комнаты: аватар владельца, участники, звезда; кебаб только owner'у.
5. **Mock parity**: всё зеркалится в MSW; persist-ключ `v2`→`v3` (старые локальные данные сбрасываются — ок). Сид уже демонстрирует матрицу (Jane — owner Titan / viewer Acme / не участник Northwind); добавить один затрашенный файл, чтобы Trash был не пуст при первом запуске.

## Модель корзины

- `nodes.deleted_at`/`deleted_by`; при удалении помечается **всё поддерево** (`collectSubtreeIds`) → все листинги фильтруются `WHERE deleted_at IS NULL`.
- Экран корзины показывает только **корни поддеревьев** (deleted-узел, чей parent null/жив).
- Restore: снимает пометку с поддерева; родитель удалён → в корень комнаты; конфликт имён → `nextAvailableName`. Упрощение (комментарий в коде): restore корня воскрешает и ранее отдельно затрашенных потомков.
- Purge = старый hard-delete путь (cascade + favorites cleanup + blobs). Storage считает и корзину (место освобождает только purge — отразить в копирайте Trash-экрана).
- Избранное trashed-узлов скрывается из `GET /favorites` фильтром (строки не удаляются — вернутся после restore).

## Реализация (по порядку: domain → contracts → db → api → regen → mocks → web → тесты)

### 1. `packages/domain/src/index.ts` (+ index.test.ts)
- `BaseNode` + `deletedAt: number | null`, `deletedBy: string | null` — **обязательные** поля, чтобы компилятор нашёл все места конструирования (моки, фейки, drizzle-маппер, api-adapters).
- `ActivityAction` + `'node.restored'`, `'member.updated'`.
- Новые helpers (одна реализация для api и моков): `roleAtLeast(role, min)` (viewer<editor<owner), `selectTrashRoots(nodes)`. Тесты на оба.

### 2. `packages/contracts/src/index.ts`
- `DataroomDto` = `Dataroom & { myRole, memberCount, owner: UserDto|null }`; новые `TrashItemDto` (узел + dataroomName + deletedAt/deletedBy + itemCount + myRole), `UpdateMemberRequest { role }`, `EmptyTrashResult { deletedIds }`. `DeleteNodeResult.deletedIds` не переименовываем.

### 3. `packages/db` (schema + миграция 0002)
- `nodes` + `deleted_at timestamptz`, `deleted_by uuid → users (set null)`; опц. partial-индекс для трэш-листинга.
- **Главный риск миграции**: оба partial unique индекса имён должны получить `AND deleted_at IS NULL` — drizzle-kit может не сдиффить смену WHERE; руками проверить, что в SQL есть DROP/CREATE обоих индексов. Иначе — конфликт unique при трэше второго одноимённого файла.
- Расширить check `activity.action`. `bun run db:migrate` на свежей БД.

### 4. `apps/api`
- **Порты/репозитории** (`datarooms.repository.port.ts` + drizzle): `listNodes` с `includeDeleted?`, `setNodesDeleted`, `restoreNodes`, `listDeletedNodes`, `listDataroomsForUser` (join members, myRole), `dataroomMeta` (memberCount+owner одним запросом); `siblingNames` — только живые. Workspace-порт: `findMemberRole`, `updateMemberRole`, `countOwners`; `addMember` без upsert.
- **Доступ** в `WorkspaceService`: `assertMember` → 404, `assertRole(min)` → 403 (через `roleAtLeast`). Проверки в сервисах, не в контроллерах.
- `datarooms.service`: listDatarooms по членству + обогащение DTO; rename/delete → owner; delete комнаты чистит блобы **включая trashed** (`includeDeleted: true`).
- `nodes.service`: все методы получают userId + проверки; `deleteNode` → soft (activity `node.deleted`, блобы/избранное не трогаем); новые `restoreNode` (правила выше, activity `node.restored`), `purgeNode` (старое тело hard-delete), `listTrash` (memberships → `selectTrashRoots` → TrashItemDto), `emptyTrash` (purge по комнатам editor+).
- **Контроллеры**: новый `trash.controller.ts` (`GET /trash`, `DELETE /trash`); nodes + `POST /nodes/:id/restore`, `DELETE /nodes/:id/purge`; workspace + `PATCH /datarooms/:id/members/:userId`; members POST → 409; last-owner guard на PATCH/DELETE; favorites: assertMember + reject trashed.
- **Тесты сервисов** (до регенерации): переписать старые delete-тесты под trash-семантику; новые — поддерево, roots-only, restore (живой родитель / trashed родитель → root / конфликт имён), purge, emptyTrash по ролям, 404 не-участнику, 403 viewer'у, owner-only операции, 409 addMember, last-owner guard (remove + demote).

### 5. Регенерация клиента
- `bun run generate` → `useListTrash`, `useEmptyTrash`, `useRestoreNode`, `usePurgeNode`, `useUpdateMember` + расширенный DataroomDto. Ожидаемая поломка typecheck: exhaustive `Record<ActivityAction,...>` в web — это детектор дрейфа, чинится в фазе web.

### 6. MSW mocks (`apps/web/src/mocks`)
- `persist.ts`: ключ `'v3'`.
- `db.ts`: `live()`-фильтр повсюду, `roleOf/requireMember(404)/requireRole(403)`, membership-фильтр listDatarooms + обогащение DTO, soft delete/restore/purge/trash/empty, 409 addMember (upsert остаётся только для owner-бутстрапа при создании комнаты), `updateMemberRole` + last-owner guard, фильтр favorites, сид: затрашить один файл.
- `handlers.ts`: `403: 'FORBIDDEN'` в errorBody, userId во все нужные хендлеры, 5 новых маршрутов. Статусы/сообщения зеркалить точно (главная зона дрейфа).

### 7. Web
- `shared/api-adapters.ts`: прокинуть deletedAt/deletedBy. Новый `shared/favorites.ts`: `useFavorites()` (isFavorite + toggle; замена ad-hoc refetch; переиспользуют строки, грид, кебабы, DetailPanel, дашборд). Вынести `UserAvatar` в shared (нужен трём экранам).
- `dataroom-browser/hooks.ts`: `deleteNode.onSuccess` → тост «Moved to trash» + `action: Undo` (restore); добавить `restoreNode`.
- Роуты: `_app.trash.tsx`, `_app.favorites.tsx`; в обоих dataroom-роутах `validateSearch` + `select?: string`.
- `DataroomBrowserScreen`: `canEdit/isOwner` из `myRole`; гейтинг «скрыть, не задизейблить» (Toolbar, RowActions, BulkBar, DetailPanel footer, upload input); звёзды (строки/грид/кебаб/DetailPanel); удаление в корзину без AlertDialog; `?select` **без useEffect** — one-shot callback-ref (scrollIntoView + preview + чистка параметра), работает благодаря remount по key; `activityText` + новые действия.
- `MembersDialog`: owner — select роли у каждого + удаление + добавление; не-owner — read-only; последний owner задизейблен (зеркало серверного guard).
- `DataroomRow` (дашборд): проп → обогащённый DataroomDto; аватар+имя владельца, `formatCount(memberCount,'member')`, звезда, кебаб только owner.
- `AppSidebar`: NAV_ITEMS → Data Rooms / Favorites / Trash (бейдж-счётчик из `useListTrash`); «View all» при >6 избранных; file-FavoriteLink со `search={{ select }}`.
- Новые экраны: `features/trash/TrashScreen` (иконка/имя/комната/deleted by/дата/размер|itemCount, Restore, Delete forever (confirm), Empty trash (confirm), EmptyState, гейтинг по myRole item'а), `features/favorites/FavoritesScreen` (комнаты/папки/файлы с контекстом, звезда-анфаворит, навигация с `?select`, EmptyState).

### 8. e2e и совместимость
- `tests/e2e/specs/files.spec.ts:38`, `folders.spec.ts:27` ждут кнопку `Delete` в confirm-диалоге — **у нас confirm при трэше исчезает**: обновить спеки под новый флоу (строка исчезает сразу после Delete в кебабе) и опционально добавить `trash.spec.ts` (trash → /trash → restore).
- e2e создают комнаты без `x-user-id` → дефолтный юзер владелец — членство их не ломает.

## Риски
1. Миграция 0002: пересоздание partial unique индексов (drizzle-kit может пропустить) — проверить SQL руками. ✅ проверено — DROP/CREATE есть.
2. MSW-дрейф (~10 изменённых + 5 новых хендлеров) — синхронизировать бок о бок с контроллерами.
3. Blanket `invalidateQueries()` маскирует пропуски ключей.
4. Restore edge-cases (родитель в корзине, конфликт имён, воскрешение поддерева — задокументированное упрощение).
5. Членство ломает старые api-тесты и меняет видимость комнат в e2e — обновить в той же фазе.
6. Обязательный `myRole` в DataroomDto — web не соберётся, пока не обновлены моки и DataroomRow (это страховка, не проблема).

## Verification
1. `bun run generate` → `bun run lint` → `bun run typecheck` → `bun run test` → `bun run build` — зелёные.
2. Свежая БД: миграции 0000→0002 применяются; повторный запуск идемпотентен. Real-режим: затрашить два одноимённых PDF (нет unique-конфликта), restore одного → суффикс.
3. Браузер (MSW): Jane видит Titan (owner) + Acme (viewer, без кебаба), не видит Northwind; переключение на другого юзера меняет набор. Viewer: нет Upload/New folder/мутаций/BulkBar, MembersDialog read-only, звезда работает. Трэш папки → Undo → вернулась; снова трэш → бейдж в сайдбаре → /trash показывает только корень → Restore (в корень, если родитель тоже в корзине) → Delete forever файла → storage уменьшился. Members: дубль → 409-тост; смена роли; демоушен/удаление последнего owner заблокированы. Звезда файла → сайдбар + /favorites → клик → папка с подсвеченным файлом (`?select`). Перезагрузка: state под `v3`.
4. `bun run test:e2e` против реального стека.
