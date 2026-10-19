# Проверка API Lampa

Цель: Samsung Tizen, указанная пользователем версия приложения v1.13.5.
Проверка исходников: 18 октября 2026 года. Исследован upstream `master`,
а не подтверждённая ревизия веб-интерфейса конкретного телевизора.

Номер оболочки приложения может отличаться от версии веб-интерфейса:
в исследованном `src/core/manifest.js` значение `app_version` — `3.3.4`.
Плагин выводит фактический `Lampa.Manifest.app_version` в консоль.
Совместимость с v1.13.5 и конкретным Tizen требует ручной проверки.

| Область       | Используемый контракт                                                                      | Основание                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Готовность    | `window.appready` либо `Listener.follow('app', …)` с `type: 'ready'`                       | [app.js](https://github.com/yumata/lampa-source/blob/master/src/app.js)                                                                      |
| Экран         | `Component.add`, `Activity.push`, внедрение `component.activity`                           | [activity.js](https://github.com/yumata/lampa-source/blob/master/src/interaction/activity/activity.js), локальный референс                   |
| Карточка      | `full`, `type: 'complite'`, `e.data.movie`, `e.object.activity.render()`                   | предоставленный `online-mod.js`, [руководство](https://github.com/OxygenSoftworks/OxygenSoftworks.github.io/blob/main/LAMPA_PLUGIN_GUIDE.md) |
| Подтверждение | `.selector`, `hover:enter`                                                                 | [controller.js](https://github.com/yumata/lampa-source/blob/master/src/core/controller.js)                                                   |
| Фокус         | `Controller.collectionSet`, `collectionFocus`, `Navigator.move`                            | controller.js, локальный референс                                                                                                            |
| Возврат       | `Activity.backward`; штатный плеер возвращается через `Controller.toggle('content')`       | activity.js, [player.js](https://github.com/yumata/lampa-source/blob/master/src/interaction/player.js)                                       |
| Видео         | `Player.play({url, title})`, `Player.playlist([item])`                                     | player.js, локальный референс                                                                                                                |
| Сессия        | `Player.listener`: `create` передаёт `{data}`, `start` и `ready` передают сам объект видео | player.js                                                                                                                                    |
| Ошибки        | `PlayerVideo.listener`, событие `error`, признак `fatal`                                   | [video.js](https://github.com/yumata/lampa-source/blob/master/src/interaction/player/video.js)                                               |
| Очистка       | `Player.listener` / `destroy`, `listener.remove(name, callback)`                           | player.js, [subscribe.js](https://github.com/yumata/lampa-source/blob/master/src/utils/subscribe.js)                                         |

`online-mod.js` использован только для изучения API, его код не переносился.
В проекте нет его источников, прокси, аналитики и настроек.

## Ограничения

- Проверка наличия методов выполняется до регистрации компонента.
- Ожидание готовности ограничено 60 секундами. При ошибке нужен перезапуск Lampa.
- Повторное исполнение скрипта в том же окне не регистрирует новые обработчики.
- Кнопка добавляется при следующем завершении загрузки карточки. Если плагин
  подключён в уже открытой карточке, нужно выйти и открыть её снова.
- Используются jQuery, Navigator и Promise из среды Lampa; они не включаются
  в бандл. Это единственный JS-файл без внешних runtime-импортов.
- Цель сборки — ES2015, без автоматических полифилов всех старых Tizen.
  Конкретный нижний порог совместимости пока не подтверждён.
- Плагин использует штатное поведение возврата плеера, не заменяя его глобальный callback.
- Адаптер различает `idle`, `opening`, `playing`. `playing` означает событие
  `Player.start`, а не подтверждённое декодирование кадров телевизором.
- При чужом `Player.create/start` адаптер освобождает свою сессию; события
  различаются по ссылке на объект видео, а не только по URL. Плейлист меняется
  только после `ready` собственной сессии. Ошибки видео во время `opening`
  не приписываются новому ролику: они могут относиться к предыдущему видео.
- `pause/stop` экрана отменяют ожидание результата источника через номер запроса.
  Поздний результат не запускает видео даже после возвращения на тот же экран.
  Подписки уже запущенного плеера при `pause` сохраняются до конца его сессии.
- Возврат контроллера `content` сбрасывает незавершённое `opening` и разрешает
  новую попытку. Адаптер не вызывает глобальный `Player.close` при замене сессии.
  Отмена ожидания не отменяет внутренние асинхронные операции самой Lampa.
- Событие уничтожения плеера снимает подписки на ошибки. Выход с экрана
  также снимает подписки и обработчики UI.
