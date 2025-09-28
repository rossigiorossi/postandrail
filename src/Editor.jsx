import { useRef, useState, useEffect } from "react";
import "./Editor.css";

const INNER = 10;           // griglia 10x10
const GRID = INNER;
const SIZE = 480;
const NODE_RADIUS = 6;
const EDGE_END_GAP = 0.02;
const EDGE_SNAP = 14;

export default function Editor() {
  const canvasRef = useRef(null);
  const [horizontal, setHorizontal] = useState(
    Array.from({ length: GRID + 1 }, () => Array(GRID).fill(0))
  );
  const [vertical, setVertical] = useState(
    Array.from({ length: GRID }, () => Array(GRID + 1).fill(0))
  );
  const [drag, setDrag] = useState(null);
  const [down, setDown] = useState(null);
  const cell = SIZE / GRID;

  const nextEdgeState = v => (v + 1) % 3; // 0→1(nero)→2(nero+obliqua)→0

  // disegna la griglia con le linee nei 3 stati
  const drawGrid = () => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, SIZE, SIZE);

    // griglia sottile
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= GRID; r++) {
      const y = r * cell;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(SIZE, y);
      ctx.stroke();
    }
    for (let c = 0; c <= GRID; c++) {
      const x = c * cell;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, SIZE);
      ctx.stroke();
    }

    const gap = cell * EDGE_END_GAP;

    // linee orizzontali
    for (let r = 0; r <= GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const s = horizontal[r][c];
        if (!s) continue;
        const x1 = c * cell + gap;
        const x2 = (c + 1) * cell - gap;
        const y  = r * cell;
        ctx.beginPath();
        ctx.strokeStyle = "black";
        ctx.lineWidth   = s === 1 ? 4 : 4;
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
        if (s === 2) {
          ctx.beginPath();
          ctx.lineWidth = 2;
          ctx.moveTo((x1 + x2)/2 - 5, y - 5);
          ctx.lineTo((x1 + x2)/2 + 5, y + 5);
          ctx.stroke();
        }
      }
    }
    // linee verticali
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c <= GRID; c++) {
        const s = vertical[r][c];
        if (!s) continue;
        const y1 = r * cell + gap;
        const y2 = (r + 1) * cell - gap;
        const x  = c * cell;
        ctx.beginPath();
        ctx.strokeStyle = "black";
        ctx.lineWidth   = s === 1 ? 4 : 4;
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
        ctx.stroke();
        if (s === 2) {
          ctx.beginPath();
          ctx.lineWidth = 2;
          ctx.moveTo(x - 5, (y1 + y2)/2 - 5);
          ctx.lineTo(x + 5, (y1 + y2)/2 + 5);
          ctx.stroke();
        }
      }
    }
  };

  useEffect(drawGrid, [horizontal, vertical]);

  const toggleAt = (gx, gy) => {
    const c = Math.min(Math.floor(gx / cell), GRID - 1);
    const r = Math.min(Math.floor(gy / cell), GRID - 1);
    const dx = gx - c * cell;
    const dy = gy - r * cell;
    const distLeft   = dx;
    const distRight  = cell - dx;
    const distTop    = dy;
    const distBottom = cell - dy;
    const min = Math.min(distLeft, distRight, distTop, distBottom);
    if (min <= EDGE_SNAP) {
      const newH = horizontal.map(row => [...row]);
      const newV = vertical.map(row => [...row]);
      if (min === distTop)        newH[r][c]     = nextEdgeState(newH[r][c]);
      else if (min === distBottom) newH[r + 1][c] = nextEdgeState(newH[r + 1][c]);
      else if (min === distLeft)   newV[r][c]     = nextEdgeState(newV[r][c]);
      else if (min === distRight)  newV[r][c + 1] = nextEdgeState(newV[r][c + 1]);
      setHorizontal(newH);
      setVertical(newV);
    }
  };

  const toGrid = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = SIZE / rect.width;
    const scaleY = SIZE / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY
    };
  };

  const handleMouseDown = e => {
    setDown({ x: e.clientX, y: e.clientY });
    setDrag({ x: e.clientX, y: e.clientY });
  };
  const handleMouseMove = e => {
    if (drag) return;
  };
  const handleMouseUp = e => {
    setDrag(null);
    if (down) {
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (moved <= 6) {
        const { x, y } = toGrid(e.clientX, e.clientY);
        toggleAt(x, y);
      }
    }
    setDown(null);
  };

  // === Esporta JSON solo linee stato 1 ===
  const exportSolution = () => {
    const horizontalOn = [];
    const verticalOn = [];
    for (let r = 0; r <= GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        if (horizontal[r][c] === 1) horizontalOn.push({ r, c });
      }
    }
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c <= GRID; c++) {
        if (vertical[r][c] === 1) verticalOn.push({ r, c });
      }
    }
    const json = JSON.stringify({ horizontal: horizontalOn, vertical: verticalOn }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schema.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="editor-wrapper">
      <button className="export-btn" onClick={exportSolution}>Esporta JSON</button>
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        className="editor-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
    </div>
  );
}
