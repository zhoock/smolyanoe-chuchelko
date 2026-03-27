import { Universe3D } from '../../../components/view/Universe3D';
import { useEffect, useRef } from 'react';

export function HomePage() {
  const sceneRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sceneRef.current) return;

    const universe = new Universe3D(sceneRef.current);

    return () => {
      universe.destroy();
      if (sceneRef.current) {
        sceneRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <section
      aria-label="Cloud scene"
      ref={sceneRef}
      style={{ width: '100%', height: '100vh', position: 'relative' }}
    />
  );
}

export default HomePage;
