#!/bin/bash

# Скрипт для настройки локальных переменных окружения
# Использование: bash scripts/setup-local-env.sh

set -e

cd "$(dirname "$0")/.."

echo "🔍 Проверка Netlify CLI..."

if ! command -v netlify &> /dev/null; then
    echo "❌ Netlify CLI не установлен"
    echo "   Установите: npm install -g netlify-cli"
    exit 1
fi

echo "✅ Netlify CLI найден"
echo ""

echo "📝 Создаём .env файл..."
echo ""

# Проверяем, существует ли .env
if [ -f ".env" ]; then
    echo "⚠️  Файл .env уже существует"
    read -p "Перезаписать? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Отменено"
        exit 1
    fi
fi

# Создаём .env файл
cat > .env << 'ENVEOF'
# Локальные переменные окружения для Netlify Dev
# Netlify Dev автоматически загрузит этот файл и передаст переменные в функции
# НЕ коммитьте этот файл в git!

# Заполните эти переменные значениями:
# 1. Из Netlify Dashboard (Site settings → Environment variables)
# 2. Или используйте значения из production (если знаете их)

DATABASE_URL=
ENCRYPTION_KEY=
JWT_SECRET=
JWT_EXPIRES_IN=7d
ENVEOF

echo "✅ Файл .env создан"
echo ""
echo "📋 Следующие шаги:"
echo ""
echo "1. Откройте Netlify Dashboard:"
echo "   https://app.netlify.com/sites/YOUR-SITE/settings/env"
echo ""
echo "2. Для каждой переменной:"
echo "   - Нажмите на переменную"
echo "   - Нажмите 'Options' → 'Edit'"
echo "   - Добавьте значение для 'Deploy Previews' и 'Branch deploys'"
echo "   - Или скопируйте значение из Production (если знаете)"
echo ""
echo "3. Или заполните .env файл вручную:"
echo "   code .env"
echo ""
echo "4. После заполнения перезапустите сервер:"
echo "   npm run dev"
echo ""

