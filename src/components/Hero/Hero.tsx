import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import './style.scss';

const photos = [
  // `image-set(
  //   url('/images/hero/1.avif') type('image/avif'),
  //   url('/images/hero/1.webp') type('image/webp'),
  //   url('/images/hero/1.jpg') type('image/jpg')
  // )`,
  `image-set(
    url('/images/hero/2.avif') type('image/avif'),
    url('/images/hero/2.webp') type('image/webp'),
    url('/images/hero/2.jpg') type('image/jpg')
  )`,
  `image-set(
    url('/images/hero/3.avif') type('image/avif'),
    url('/images/hero/3.webp') type('image/webp'),
    url('/images/hero/3.jpg') type('image/jpg')
  )`,
  `image-set(
    url('/images/hero/4.avif') type('image/avif'),
    url('/images/hero/4.webp') type('image/webp'),
    url('/images/hero/4.jpg') type('image/jpg')
  )`,
  `image-set(
    url('/images/hero/5.avif') type('image/avif'),
    url('/images/hero/5.webp') type('image/webp'),
    url('/images/hero/5.jpg') type('image/jpg')
  )`,
  `image-set(
    url('/images/hero/6.avif') type('image/avif'),
    url('/images/hero/6.webp') type('image/webp'),
    url('/images/hero/6.jpg') type('image/jpg')
  )`,
  `image-set(
    url('/images/hero/7.avif') type('image/avif'),
    url('/images/hero/7.webp') type('image/webp'),
    url('/images/hero/7.jpg') type('image/jpg')
  )`,
  `image-set(
    url('/images/hero/8.avif') type('image/avif'),
    url('/images/hero/8.webp') type('image/webp'),
    url('/images/hero/8.jpg') type('image/jpg')
  )`,
  `image-set(
    url('/images/hero/9.avif') type('image/avif'),
    url('/images/hero/9.webp') type('image/webp'),
    url('/images/hero/9.jpg') type('image/jpg')
  )`,
];

export default function Hero() {
  const [backgroundImage, setBackgroundImage] = useState('');
  const location = useLocation(); // Хук для отслеживания изменений URL

  useEffect(() => {
    // При каждом изменении URL выбираем новое случайное изображение
    const randomIndex = Math.floor(Math.random() * photos.length);
    setBackgroundImage(photos[randomIndex]);
  }, [location.pathname]); // Зависимость от пути (pathname)

  return (
    <section className="hero" style={{ backgroundImage }}>
      <h1 className="hero__title">Cмоляное чучелко</h1>
    </section>
  );
}
