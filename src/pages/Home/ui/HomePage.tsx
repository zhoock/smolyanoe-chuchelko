import { CloudCanvas } from '../../../components/view/CloudCanvas';
import { CloudNoise } from '../../../components/view/CloudNoise';
import { useEffect, useRef } from 'react';

export function HomePage() {
  const sceneRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sceneRef.current) return;

    const cloud = new CloudCanvas(sceneRef.current, (artistId) => {
      window.dispatchEvent(new CustomEvent('player:open', { detail: { artistId } }));
    });
    const noise = new CloudNoise(sceneRef.current, () => cloud.getClusterCenters());

    return () => {
      noise.destroy();
      cloud.destroy();
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
