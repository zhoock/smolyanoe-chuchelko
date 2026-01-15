-- Миграция: Удаление пользователя feedback@smolyanoechychelko.ru
-- Дата: 2025

-- Удаляем пользователя feedback@smolyanoechychelko.ru
-- CASCADE удалит все связанные данные (альбомы, треки, статьи, заказы и т.д.)
DELETE FROM users 
WHERE email = 'feedback@smolyanoechychelko.ru';

-- Проверяем, что пользователь удален
-- Если пользователь не был найден, запрос просто не удалит ничего (это нормально)