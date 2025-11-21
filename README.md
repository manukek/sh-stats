# Sh-stats


## Старт
- `npm install`
- `cp .env.example .env` и заполните значения
- `npm run dev` для локального http-сервера `http://localhost:8787`

## Скрипты
- `npm run build` — компиляция в `dist/`
- `npm start` — запуск собранного сервера
- `npm run render` — разовая генерация `public/widget.svg` и `public/index.html`

## Деплой на GitHub Pages
1. Cкопируйте содержимое `.env` в секрет `WIDGET_ENV`.
2. Воркфлоу `.github/workflows/deploy.yml` можно запустить вручную или просто пушить в `main`. Он собирает TypeScript, вызывает `npm run render:dist` и публикует `public/` на Pages.
3. После первого прогона в настройках Pages появится адрес вида `https://<user>.github.io/<repo>/`. SVG лежит по пути `/widget.svg`, страницу для предпросмотра отдаёт `index.html`.

Created
by [Manukq](https://manukq.systems/)