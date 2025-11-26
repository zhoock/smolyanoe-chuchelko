#!/bin/bash

# Скрипт для заполнения .env файла значениями из Netlify
# Использование: bash scripts/fill-env-from-netlify.sh

set -e

cd "$(dirname "$0")/.."

echo "🔍 Проверка Netlify CLI..."

if ! command -v netlify &> /dev/null; then
    echo "❌ Netlify CLI не установлен"
    exit 1
fi

echo "✅ Netlify CLI найден"
echo ""

echo "📝 Попытка получить значения из Netlify..."
echo ""

# Пробуем получить значения из production контекста
DATABASE_URL=$(netlify env:get DATABASE_URL --context production 2>&1 | grep -v "No value" | head -1 || echo "")
ENCRYPTION_KEY=$(netlify env:get ENCRYPTION_KEY --context production 2>&1 | grep -v "No value" | head -1 || echo "")
JWT_SECRET=$(netlify env:get JWT_SECRET --context production 2>&1 | grep -v "No value" | head -1 || echo "")
JWT_EXPIRES_IN=$(netlify env:get JWT_EXPIRES_IN --context production 2>&1 | grep -v "No value" | head -1 || echo "7d")

# Проверяем, получили ли мы значения (не пустые и не только звёздочки)
if [[ "$DATABASE_URL" == *"****"* ]] || [[ -z "$DATABASE_URL" ]]; then
    echo "⚠️  Не удалось получить DATABASE_URL (значение скрыто)"
    echo "   Заполните вручную в .env файле"
    DATABASE_URL=""
fi

if [[ "$ENCRYPTION_KEY" == *"****"* ]] || [[ -z "$ENCRYPTION_KEY" ]]; then
    echo "⚠️  Не удалось получить ENCRYPTION_KEY (значение скрыто)"
    echo "   Заполните вручную в .env файле"
    ENCRYPTION_KEY=""
fi

if [[ "$JWT_SECRET" == *"****"* ]] || [[ -z "$JWT_SECRET" ]]; then
    echo "⚠️  Не удалось получить JWT_SECRET (значение скрыто)"
    echo "   Заполните вручную в .env файле"
    JWT_SECRET=""
fi

# Создаём .env файл
cat > .env << EOF
# Локальные переменные окружения для Netlify Dev
# Автоматически заполнено из Netlify (если значения не скрыты)
# НЕ коммитьте этот файл в git!

DATABASE_URL=${DATABASE_URL}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=${JWT_EXPIRES_IN:-7d}
EOF

echo ""
echo "✅ Файл .env обновлён"
echo ""

# Проверяем, все ли переменные заполнены
if [[ -z "$DATABASE_URL" ]] || [[ -z "$ENCRYPTION_KEY" ]] || [[ -z "$JWT_SECRET" ]]; then
    echo "⚠️  Некоторые переменные пустые (значения скрыты в Netlify)"
    echo ""
    echo "📋 Что делать:"
    echo "1. Откройте .env файл: code .env"
    echo "2. Заполните пустые переменные вручную"
    echo "3. Или установите переменные для dev контекста в Netlify Dashboard:"
    echo "   https://app.netlify.com/sites/YOUR-SITE/settings/env"
    echo ""
else
    echo "✅ Все переменные заполнены!"
    echo ""
    echo "🚀 Теперь запустите: npm run dev"
fi

