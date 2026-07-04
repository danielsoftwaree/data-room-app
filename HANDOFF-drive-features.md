# Handoff — Drive-класс фичи: Корзина, Избранное, Owner, Доступы

Статус на момент записи: бэкенд полностью готов и протестирован; веб-слой почти готов;
осталось доделать экран Favorites, два роута и финальную проверку (typecheck/lint/build/браузер).

## Что делаем и почему

Data Room MVP довели до уровня Google Drive:
1. **Корзина (Trash)** — раньше удаление было жёстким («cannot be undone»). Теперь soft delete узлов
   с восстановлением, экраном `/trash`, тостом «Moved to trash» + **Undo**.
2. **Доступы (Access)** — роли owner/editor/viewer теперь реально применяются: видишь только свои комнаты,
   мутации гейтятся по роли, есть guard последнего owner.
3. **Избранное (Favorites)** — звёзды на строках/гриде/detail/дашборде, экран `/favorites`,
   deep-link к файлу через `?select=<nodeId>`.
4. **Owner на дашборде** — `DataroomDto` обогащён `myRole`/`memberCount`/`owner`.

Полный план и продуктовые решения — в `C:\Users\etset\.claude\plans\valiant-yawning-plum.md`
(скопированы ключевые пункты ниже).

## Продуктовые решения (зафиксированы)

- Корзина только для узлов; удаление комнаты остаётся жёстким (owner-only, с confirm).
- Trash в стиле Drive: в корзину **без confirm**, мгновенно, тост Undo. Confirm — только для
  «Delete forever», «Empty trash», удаления комнаты. Ретеншн («30 дней») не обещаем (нет джоб).
- Доступы = членство: не-участнику **404** (не палим существование), участнику без прав — **403**.
  Мутации узлов — editor+; участники и rename/delete комнаты — owner-only; viewer — read-only (+избранное).
- Смена роли — новый `PATCH /datarooms/:id/members/:userId`; POST addMember → 409 для существующего.
- Storage считает и корзину (место освобождает только purge).
- Mock parity: всё зеркалится в MSW; persist-ключ `v2`→`v3`; сид: у 6 демо-юзеров разные членства,
  один файл («Cash Flow.pdf») уже в корзине для наглядности.

## Модель корзины (реализована)

- `nodes.deleted_at`/`deleted_by`; при удалении помечается всё поддерево (`collectSubtreeIds`).
- Все листинги фильтруются `WHERE deleted_at IS NULL`. Trash-экран показывает только корни поддеревьев
  (`selectTrashRoots` в `@repo/domain`).
- Restore: снимает пометку с поддерева; родитель в корзине/отсутствует → в корень; конфликт имён → `nextAvailableName`.
- Purge = старый hard-delete (cascade + favorites cleanup + blobs).
- Partial unique индексы имён получили `AND deleted_at IS NULL` (миграция 0002).

## СДЕЛАНО ✅

### Фаза 1 — domain (`packages/domain/src/index.ts`)
- `BaseNode` + `deletedAt`/`deletedBy` (обязательные).
- `ActivityAction` + `node.restored`, `member.updated`.
- Хелперы `roleAtLeast`, `selectTrashRoots` (+ тесты в `index.test.ts`).

### Фаза 2 — contracts (`packages/contracts/src/index.ts`)
- `DataroomDto = Dataroom & { myRole, memberCount, owner }`.
- `TrashItemDto`, `UpdateMemberRequest`, `EmptyTrashResult`; `NodeDto` несёт deletedAt/By.

### Фаза 3 — db (`packages/db`)
- `schema.ts`: `nodes.deleted_at/deleted_by`, partial-индекс `nodes_deleted_idx`,
  пересозданы unique-индексы имён с `deleted_at IS NULL`, расширен `activity_action_check`.
- Миграция **`migrations/0002_quick_titania.sql`** сгенерирована и проверена вручную (DROP/CREATE индексов есть).
  ⚠️ ЕЩЁ НЕ ПРИМЕНЕНА к живой БД — нужно `docker compose up -d` + `bun --filter @repo/db db:migrate`.

### Фаза 4 — API (`apps/api`) + тесты
- Репозитории: `listDataroomsForUser`, `dataroomMeta`, `listDeletedNodes`, `setNodesDeleted`,
  `restoreNodes`, `findMemberRole`, `countOwners`, `updateMemberRole`; `siblingNames`/`listNodes` фильтруют live;
  `addMember` без upsert (onConflictDoNothing); `listFavorites` фильтрует членство + trashed.
- `WorkspaceService`: `getRole/assertMember(404)/assertRole(403)`, `updateMemberRole`, last-owner guard, 409.
- `DataroomsService`: membership-фильтр + обогащение DTO; rename/delete → owner.
- `NodesService`: role-checks; `deleteNode` → soft; новые `restoreNode`, `purgeNode`, `listTrash`, `emptyTrash`.
- Контроллеры: новый `trash.controller.ts` (GET/DELETE `/trash`), `POST /nodes/:id/restore`,
  `DELETE /nodes/:id/purge`, `PATCH /datarooms/:id/members/:userId`; userId проброшен во все read-эндпоинты.
- DTO: `DataroomDto` (myRole/memberCount/owner), `TrashItemDto`, `EmptyTrashResultDto`, `UpdateMemberDto`,
  `NodeDto` deletedAt/By, `ActivityDto` enum расширен.
- Тесты переписаны под trash-семантику + доступы: **`bun --filter api test` → 62 pass, 0 fail** ✅
  (unit `datarooms.service.test.ts` с shared-membership фейками + integration `app.integration.spec.ts` фейки обновлены).
- **`bun run typecheck --filter=api` → зелёный** ✅

### Фаза 5 — регенерация клиента
- `bun run generate` прошёл; появились `useListTrash`, `useEmptyTrash`, `useRestoreNode`, `usePurgeNode`,
  `useUpdateMember` + модели `trashItemDto`, `updateMemberDto`, обогащённый `dataroomDto`.

### Фаза 6 — MSW моки (`apps/web/src/mocks`)
- `db.ts`: `roleOf/requireMember(404)/requireRole(403)`, membership-фильтр `listDatarooms`, обогащение DTO,
  soft delete/restore/purge/trash/empty, 409 addMember, `updateMemberRole` + last-owner guard,
  фильтр favorites, `live()`/`getLiveNode`/`getAnyNode`, seed-флаг `seeding`, затрашен «Cash Flow.pdf».
- `handlers.ts`: 403 FORBIDDEN, userId во все хендлеры, 5 новых маршрутов (trash GET/DELETE, restore, purge, PATCH member).
- `persist.ts`: ключ `v3`.

### Фаза 7 — Web UI (частично)
- `shared/favorites.ts` — `useFavorites()` (isFavorite + toggle). **ГОТОВО**
- `shared/UserAvatar.tsx` — общий аватар. **ГОТОВО**
- `shared/api-adapters.ts` — прокинуты deletedAt/By. **ГОТОВО**
- `dataroom-browser/hooks.ts` — `restoreNode` + тост «Moved to trash» + Undo. **ГОТОВО**
- `DataroomBrowserScreen.tsx` — гейтинг по `myRole` (Toolbar/RowActions/BulkBar/DetailPanel/контекст-меню/upload),
  звёзды в строках/гриде/detail/контексте, удаление в корзину без confirm, `?select` через callback-ref
  (без useEffect), убран delete-AlertDialog. **ГОТОВО**
- `DetailPanel.tsx` — звезда в шапке + гейтинг футера. **ГОТОВО**
- `MembersDialog.tsx` — owner: смена ролей (Select) + удаление + добавление; не-owner: read-only;
  последний owner задизейблен. **ГОТОВО**
- `DataroomRow.tsx` — owner-аватар/имя, memberCount, role-бейдж, звезда, кебаб только owner. **ГОТОВО**
- `DataroomsScreen.tsx` — прокинуты favorites-контролы + типы DataroomDto. **ГОТОВО**
- `AppSidebar.tsx` — nav Data Rooms/Favorites/Trash + бейдж-счётчик trash, «View all» при >6,
  file-FavoriteLink со `?select`. **ГОТОВО**
- `routes/_app.datarooms.$dataroomId.index.tsx` и `.folders.$folderId.tsx` — `validateSearch` + `select`,
  `selectNodeId`/`onConsumeSelect`. **ГОТОВО**
- `features/trash/{hooks.ts,components/TrashScreen.tsx,index.ts}` — **ГОТОВО**

## ОСТАЛОСЬ СДЕЛАТЬ ⬜

### Фаза 7 (доделать)
1. **`features/favorites/components/FavoritesScreen.tsx`** + `features/favorites/index.ts` —
   список из `useListFavorites`: строки комната/папка/файл с иконкой (Vault/Folder/FilePdf),
   контекст «in {dataroomName}», звезда-анфаворит (`useFavorites().toggle`), навигация:
   room → `/datarooms/$id`; folder → `/datarooms/$id/folders/$nodeId`;
   file → родительская папка (или root) с `search={{ select: nodeId }}`. EmptyState «No favorites yet».
   Паттерн строки — как `DataroomRow`/`TrashScreen` (Link flex-1 + отдельная кнопка-звезда).
2. **`routes/_app.trash.tsx`** → `TrashScreen` (по образцу `_app.index.tsx`).
3. **`routes/_app.favorites.tsx`** → `FavoritesScreen`.
   (routeTree.gen.ts пересоберётся Vite-плагином на dev/build.)

### Фаза 8 — e2e / совместимость
- `tests/e2e/specs/files.spec.ts:38` и `folders.spec.ts:27` ждут кнопку **`Delete`** в confirm-диалоге —
  **мы убрали confirm при трэше**. Обновить: после клика «Delete»/«Move to trash» в кебабе строка исчезает сразу
  (без диалога). Опционально `trash.spec.ts` (trash → /trash → restore).
- e2e создают комнаты без `x-user-id` → дефолтный юзер = owner, членство их не ломает.

### Фаза 9 — верификация (ОБЯЗАТЕЛЬНО)
1. `bun run generate` → `bun run typecheck` → `bun run lint` → `bun run test` → `bun run build` — всё зелёное.
   ⚠️ Web-часть ещё НЕ прогонялась через typecheck/lint/build после правок фазы 7 — вероятны мелкие правки
   (сигнатуры хуков `useRestoreNode`/`usePurgeNode`/`useEmptyTrash`/`useUpdateMember`, неиспользуемые импорты).
2. Свежая БД: `docker compose down -v && up -d`, `bun --filter @repo/db db:migrate` (0000→0002 применяются).
   Real-режим (`bun run dev:real`): затрашить два одноимённых PDF (нет unique-конфликта), restore → суффикс.
3. Браузер (MSW, localhost:5173):
   - Jane видит Titan (owner) + Acme (viewer, без кебаба), НЕ видит Northwind; переключение юзера меняет набор.
   - Viewer в Acme: нет Upload/New folder/мутаций/BulkBar, MembersDialog read-only, звезда работает.
   - Трэш файла → тост Undo → вернулся; трэш папки → бейдж Trash в сайдбаре → `/trash` показывает только корень →
     Restore (в корень, если родитель тоже в корзине) → Delete forever → storage уменьшился; Empty trash.
   - Members: дубль → 409-тост; смена роли; демоушен/удаление последнего owner заблокированы.
   - Звезда файла → сайдбар + `/favorites` → клик по файлу → папка с подсвеченным файлом (`?select`).
   - Перезагрузка: state под `v3`.

## Риски / на что смотреть
- **Сигнатуры сген-хуков**: проверить `useRestoreNode({id})`, `usePurgeNode({id})`, `useEmptyTrash(undefined)`,
  `useUpdateMember({id,userId,data:{role}})` — если orval сгенерил иначе, поправить вызовы в
  `dataroom-browser/hooks.ts`, `trash/hooks.ts`, `MembersDialog.tsx`.
- **MSW-дрейф** — самая большая зона ручной синхронизации; integration-тесты API — единственный авто-детектор.
- **e2e** сломается на confirm-диалоге удаления — обновить в фазе 8.
- Web не соберётся, пока не создан FavoritesScreen (роут импортит его) — создать до typecheck.

## Полезные команды
- Бэкенд-проверка: `bun run typecheck --filter=api`, `cd apps/api && bun test`.
- Регенерация клиента: `bun run generate`.
- Полная проверка: `bun run typecheck && bun run lint && bun run test && bun run build`.
- Dev (MSW): `bun run dev`. Dev (реальный API+БД): `bun run dev:real`.
