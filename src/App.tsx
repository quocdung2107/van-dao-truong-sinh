import { useEffect, useRef } from 'react';
import { Game } from './game/Game';
import HUD from './ui/HUD';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const game = new Game(canvasRef.current);
    const onResize = () => game.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      game.dispose();
    };
  }, []);

  return (
    <div className="app-shell">
      <div className="game-title">🏔️ VẠN ĐẠO TRƯỜNG SINH <span>— Thanh Vân Sơn (Prototype)</span></div>
      <canvas ref={canvasRef} className="game-canvas" />
      <HUD />
    </div>
  );
}
