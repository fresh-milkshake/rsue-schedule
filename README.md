<p align="left"><img src="public/icon.svg" width="72" alt="Расписание РИНХ"></p>

# Расписание РИНХ

Неофициальный минималистичный Android-клиент [расписания РГЭУ (РИНХ)](https://rasp.rsue.ru/). Расписание по дням и неделям, выбор группы и напоминания об окончании занятий. Сохранённое расписание доступно без сети.

![Tauri](https://img.shields.io/badge/Tauri-2-24C8D8?style=for-the-badge&logo=tauri&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white)

| Выбор группы | День |
|:---:|:---:|
| <img src="docs/screenshots/onboarding.webp" width="260" alt="Выбор группы"> | <img src="docs/screenshots/day.webp" width="260" alt="День, ИБ-312"> |
| Неделя | Настройки |
| <img src="docs/screenshots/week.webp" width="260" alt="Неделя, БИН-321"> | <img src="docs/screenshots/settings.webp" width="260" alt="Настройки"> |

## Запуск

Node.js 22.12+, Rust и Android SDK/NDK (Android Studio).

```sh
npm ci
npm run dev
```

## Android

```sh
npm run android:build
```

APK создаётся в `src-tauri/gen/android/app/build/outputs/apk/universal/release/`. Подписать для установки: `npm run android:sign -- <путь-к-unsigned.apk>`.

Проверки: `npm test` · `npm run build`. Иконки: `npm run icons`.

## Лицензия

Проект лицензирован под лицензией [MIT](LICENSE).
