import { useEffect, useRef, useState } from 'react';
import { Game } from './game/Game';
import HUD from './ui/HUD';
import CreationScreen from './ui/CreationScreen';
import { peekCharacter, createCharacterSave, type CharacterInfo } from './game/cultivation';
import { bridge } from './game/store';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Màn hình tạo nhân vật hiện khi chưa có nhân vật trong save (save mới hoặc save v1 cũ).
  // Game chỉ khởi động SAU khi đã tạo nhân vật — đơn giản và tránh lỗi trạng thái.
  const [hasChar, setHasChar] = useState<boolean>(() => peekCharacter() !== null);
  const [session, setSession] = useState(0);

  useEffect(() => {
    if (!hasChar) return;
    return bridge.onReset(() => { setHasChar(false); });
  }, [hasChar]);

  useEffect(() => {
    if (!hasChar || !canvasRef.current) return;
    const game = new Game(canvasRef.current);
    const onResize = () => game.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      game.dispose();
    };
  }, [hasChar, session]);

  const handleCreate = (c: CharacterInfo) => {
    createCharacterSave(c);
    setSession((n) => n + 1);
    setHasChar(true);
  };

  return (
    <div className="app-shell">
      <div className="game-title">🏔️ VẠN ĐẠO TRƯỜNG SINH <span>— Giai đoạn 2: World</span></div>
      <canvas ref={canvasRef} className="game-canvas" />
      {hasChar && <HUD />}
      {!hasChar && <CreationScreen onCreate={handleCreate} />}
    </div>
  );
}
