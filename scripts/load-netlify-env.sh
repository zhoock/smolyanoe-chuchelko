#!/bin/bash

# Скрипт для загрузки переменных окружения из Netlify
# Использование: source scripts/load-netlify-env.sh

set -e

echo "🔍 Проверка Netlify CLI..."

# Проверяем наличие Netlify CLI
if ! command -v netlify &> /dev/null; then
    echo "❌ Netlify CLI не установлен"
    echo ""
    echo "📦 Установите Netlify CLI:"
    echo "   npm install -g netlify-cli"
    echo ""
    echo "Или через Homebrew:"
    echo "   brew install netlify-cli"
    exit 1
fi

echo "✅ Netlify CLI найден: $(netlify --version 2>/dev/null || echo 'версия неизвестна')"
echo ""

# Проверяем, авторизован ли пользователь
if ! netlify status &> /dev/null; then
    echo "🔐 Требуется авторизация в Netlify"
    echo "   Выполните: netlify login"
    exit 1
fi

# Проверяем, связан ли проект
if [ ! -f ".netlify/state.json" ]; then
    echo "🔗 Проект не связан с Netlify"
    echo "   Выполните: netlify link"
    exit 1
fi

echo "📥 Загрузка переменных окружения из Netlify..."
echo ""

# Получаем переменные окружения из Netlify
NETLIFY_ENV=$(netlify env:list --json 2>/dev/null)

if [ -z "$NETLIFY_ENV" ] || [ "$NETLIFY_ENV" = "[]" ]; then
    echo "⚠️  Переменные окружения не найдены в Netlify"
    echo "   Проверьте настройки в Netlify Dashboard"
    exit 1
fi

# Парсим JSON и экспортируем переменные
# Формат: {"DATABASE_URL": "value", "ENCRYPTION_KEY": "value"}
if command -v jq &> /dev/null; then
    echo "$NETLIFY_ENV" | jq -r 'to_entries[] | select(.value != "" and .value != null) | "export \(.key)=\"\(.value)\""' | while read -r line; do
        echo "   $line"
        eval "$line"
    done
elif command -v node &> /dev/null; then
    echo "$NETLIFY_ENV" | node -e "
        const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
        Object.entries(data).forEach(([key, value]) => {
            if (value && value !== '') {
                // Экранируем кавычки в значении
                const escapedValue = String(value).replace(/\"/g, '\\\"');
                console.log(\`export \${key}=\"\${escapedValue}\"\`);
            }
        });
    " | while read -r line; do
        echo "   $line"
        eval "$line"
    done
else
    echo "❌ Требуется jq или node для парсинга JSON"
    echo "   Установите jq: brew install jq"
    echo "   Или используйте node (уже должен быть установлен)"
    exit 1
fi

echo ""
echo "✅ Переменные окружения загружены!"
echo ""
echo "🔍 Доступные переменные:"
env | grep -E "(DATABASE_URL|ENCRYPTION_KEY|YOOKASSA_)" | sed 's/=.*/=***/' || echo "   (переменные не найдены)"

