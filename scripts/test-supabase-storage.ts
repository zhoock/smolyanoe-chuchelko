import { createSupabaseClient, STORAGE_BUCKET_NAME } from '../src/config/supabase';

async function testStorage() {
  const supabase = createSupabaseClient();

  if (!supabase) {
    console.error(
      '❌ Supabase client is not available. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
    return;
  }

  console.log('🔍 Проверка подключения к Supabase...');
  console.log('📍 URL:', supabase.supabaseUrl);
  console.log('🔑 Anon key:', supabase.supabaseKey.substring(0, 20) + '...');

  // Пробуем получить список buckets (может не работать из-за RLS)
  console.log('\n📦 Попытка получить список buckets...');
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

  if (bucketsError) {
    console.log('⚠️  Не удалось получить список buckets:', bucketsError.message);
    console.log('💡 Это нормально, если RLS ограничивает просмотр списка buckets');
  } else {
    console.log('✅ Buckets:', buckets);
    console.log(`📊 Найдено buckets: ${buckets?.length || 0}`);

    const bucketExists = buckets?.some((bucket) => bucket.name === STORAGE_BUCKET_NAME);
    if (bucketExists) {
      console.log(`✅ Bucket "${STORAGE_BUCKET_NAME}" найден в списке!`);
    }
  }

  // Проверяем доступ к bucket напрямую (более надёжный способ)
  console.log(`\n📁 Проверка доступа к bucket "${STORAGE_BUCKET_NAME}" напрямую...`);
  const { data: files, error: filesError } = await supabase.storage
    .from(STORAGE_BUCKET_NAME)
    .list('', { limit: 1 });

  if (filesError) {
    console.error(`❌ Ошибка при доступе к bucket "${STORAGE_BUCKET_NAME}":`, filesError);
    console.error('\n💡 Возможные причины:');
    console.error('   1. Bucket не существует или имеет другое имя');
    console.error('   2. Bucket не помечен как Public');
    console.error('   3. RLS политики не настроены для чтения');
    console.error('   4. Неверный anon ключ');
    console.error('\n📋 Что проверить в Supabase Dashboard:');
    console.error('   - Storage → Buckets → "user-images" должен быть Public');
    console.error(
      '   - Storage → Buckets → "user-images" → Policies → должна быть политика "Public read access"'
    );
    return;
  }

  console.log(`✅ Bucket "${STORAGE_BUCKET_NAME}" доступен!`);
  console.log(`📊 Файлов в корне: ${files?.length || 0}`);

  // Проверяем получение публичного URL (если bucket публичный)
  console.log(`\n🔗 Проверка получения публичного URL...`);
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET_NAME)
    .getPublicUrl('test/path.jpg');

  if (urlData?.publicUrl) {
    console.log('✅ Публичные URL работают!');
    console.log(`   Пример: ${urlData.publicUrl}`);
  } else {
    console.log('⚠️  Не удалось получить публичный URL');
  }
}

testStorage();
