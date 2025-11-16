#!/bin/bash

# Скрипт для проверки статуса Supabase проекта

PROJECT_ID="jhpvetvfnsklpwswadle"

echo "🔍 Проверка статуса Supabase проекта: $PROJECT_ID"
echo ""

echo "1. Проверка DNS для прямого подключения:"
nslookup db.${PROJECT_ID}.supabase.co 2>&1 | grep -E "(Name:|Address:|Can't find)" || echo "   ❌ DNS не резолвится"

echo ""
echo "2. Проверка доступности через пулер (разные регионы):"
for region in us-east-1 us-west-1 eu-west-1 eu-central-1 ap-southeast-1; do
  if timeout 2 bash -c "echo > /dev/tcp/aws-0-${region}.pooler.supabase.com/6543" 2>/dev/null; then
    echo "   ✅ Регион $region доступен"
    echo "   Попробуйте: postgresql://postgres.${PROJECT_ID}:PASSWORD@aws-0-${region}.pooler.supabase.com:6543/postgres"
  else
    echo "   ❌ Регион $region недоступен"
  fi
done

echo ""
echo "📋 Что делать:"
echo "1. Откройте Supabase Dashboard: https://supabase.com/dashboard/project/${PROJECT_ID}"
echo "2. Проверьте статус проекта (должен быть 'Active' или 'Ready')"
echo "3. Если статус 'Provisioning' - подождите 10-15 минут"
echo "4. Если проект активен, но Connection string не работает:"
echo "   - Проверьте Settings → Database → Connection string"
echo "   - Или создайте новый проект Supabase"

