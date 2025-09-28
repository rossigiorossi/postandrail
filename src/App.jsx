import { useRef, useEffect, useState } from "react";
import "./App.css";

const INNER = 10;
const BORDER = 1;
const GRID = INNER + 2 * BORDER;
const SIZE = 560;
const NODE_RADIUS = 6;
const EDGE_END_GAP = 0.02;
const EDGE_SNAP = 14;

export default function App() {
  const mainCanvasRef = useRef(null);
  const miniCanvasRef = useRef(null);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState(null);
  const [down, setDown] = useState(null);
  const [lastPinch, setLastPinch] = useState(null);
  const TAP_MAX = 6;

  const [horizontal, setHorizontal] = useState(
    Array.from({ length: GRID + 1 }, () => Array(GRID).fill(0))
  );
  const [vertical, setVertical] = useState(
    Array.from({ length: GRID }, () => Array(GRID + 1).fill(0))
  );
  const [nodes, setNodes] = useState(
    Array.from({ length: GRID + 1 }, () => Array(GRID + 1).fill(0))
  );

  const cell = SIZE / GRID;

  const drawGrid = (ctx, zoom = 1, off = { x: 0, y: 0 }) => {
    ctx.save();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.scale(zoom, zoom);
    ctx.translate(off.x / zoom, off.y / zoom);

    // contorno 10x10
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.strokeRect(BORDER * cell, BORDER * cell, INNER * cell, INNER * cell);

    // griglia interna
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 0.5;
    for (let r = BORDER + 1; r < GRID - BORDER; r++) {
      const y = r * cell;
      ctx.beginPath();
      ctx.moveTo(BORDER * cell, y);
      ctx.lineTo((GRID - BORDER) * cell, y);
      ctx.stroke();
    }
    for (let c = BORDER + 1; c < GRID - BORDER; c++) {
      const x = c * cell;
      ctx.beginPath();
      ctx.moveTo(x, BORDER * cell);
      ctx.lineTo(x, (GRID - BORDER) * cell);
      ctx.stroke();
    }

    const gap = cell * EDGE_END_GAP;

    // linee attive
    ctx.strokeStyle = "black";
    for (let r = 0; r <= GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const s = horizontal[r][c];
        if (!s) continue;
        if (r < BORDER || r > GRID - BORDER || c < BORDER || c >= GRID - BORDER) continue;
        const x1 = c * cell + gap;
        const x2 = (c + 1) * cell - gap;
        const y  = r * cell;
        ctx.beginPath();
        ctx.lineWidth = 2;
        if (s === 1) {
          ctx.moveTo(x1, y);
          ctx.lineTo(x2, y);
        } else if (s === 2) {
          const cx = (x1 + x2) / 2;
          ctx.moveTo(cx - 5, y - 5);
          ctx.lineTo(cx + 5, y + 5);
        }
        ctx.stroke();
      }
    }
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c <= GRID; c++) {
        const s = vertical[r][c];
        if (!s) continue;
        if (r < BORDER || r >= GRID - BORDER || c < BORDER || c > GRID - BORDER) continue;
        const y1 = r * cell + gap;
        const y2 = (r + 1) * cell - gap;
        const x  = c * cell;
        ctx.beginPath();
        ctx.lineWidth = 2;
        if (s === 1) {
          ctx.moveTo(x, y1);
          ctx.lineTo(x, y2);
        } else if (s === 2) {
          const cy = (y1 + y2) / 2;
          ctx.moveTo(x - 5, cy - 5);
          ctx.lineTo(x + 5, cy + 5);
        }
        ctx.stroke();
      }
    }

    // nodi
    for (let r = BORDER; r <= GRID - BORDER; r++) {
      for (let c = BORDER; c <= GRID - BORDER; c++) {
        const s = nodes[r][c];
        if (!s) continue;
        const x = c * cell;
        const y = r * cell;
        ctx.beginPath();
        if (s === 1) {
          ctx.fillStyle = "black";
          ctx.arc(x, y, NODE_RADIUS, 0, Math.PI * 2);
          ctx.fill();
        } else if (s === 2) {
          ctx.strokeStyle = "black";
          ctx.lineWidth = 2;
          ctx.arc(x, y, NODE_RADIUS, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // === Etichette ===
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // sopra
    ctx.font = `${cell * 0.42}px sans-serif`;
    for (let c = 0; c <= INNER; c++) {
      const x = (BORDER + c) * cell;
      const baseY = BORDER * cell - cell * 0.8; // più lontano dalla griglia
      ctx.fillText("7", x, baseY);
      // cerchio col 3 più distaccato
      const cy = baseY + cell * 0.45;
      ctx.beginPath();
      ctx.arc(x, cy, cell * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.font = `${cell * 0.34}px sans-serif`;
      ctx.fillText("3", x, cy);
      ctx.fillStyle = "black";
      ctx.font = `${cell * 0.42}px sans-serif`;
    }

    // sinistra (7 e cerchio col 3 sulla stessa linea)
    for (let r = 0; r <= INNER; r++) {
      const y = (BORDER + r) * cell;
      const leftX = BORDER * cell - cell * 0.8; // più a sinistra
      ctx.textAlign = "right";
      ctx.fillText("7", leftX, y);
      const circleX = leftX + cell * 0.5;
      ctx.beginPath();
      ctx.arc(circleX, y, cell * 0.18, 0, Math.PI * 2);
      ctx.fill();
      // 3 perfettamente centrato
      ctx.fillStyle = "white";
      ctx.font = `${cell * 0.34}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("3", circleX, y);
      ctx.fillStyle = "black";
      ctx.font = `${cell * 0.42}px sans-serif`;
      ctx.textAlign = "right";
    }

    ctx.restore();
  };

  useEffect(() => {
    drawGrid(mainCanvasRef.current.getContext("2d"), scale, offset);
    const mctx = miniCanvasRef.current.getContext("2d");
    mctx.clearRect(0, 0, mctx.canvas.width, mctx.canvas.height);
    drawGrid(mctx, 1, { x: 0, y: 0 });
  }, [scale, offset, horizontal, vertical, nodes]);

  const nextEdgeState = v => (v + 1) % 3;
  const nextNodeState = v => (v + 1) % 3;

  const toGrid = (clientX, clientY, target = mainCanvasRef) => {
    const rect = target.current.getBoundingClientRect();
    const scaleX = target.current.width / rect.width;
    const scaleY = target.current.height / rect.height;
    const isMain = target === mainCanvasRef;
    return {
      x: (clientX - rect.left) * scaleX / (isMain ? scale : 1) - (isMain ? offset.x / scale : 0),
      y: (clientY - rect.top)  * scaleY / (isMain ? scale : 1) - (isMain ? offset.y / scale : 0)
    };
  };

  const toggleAt = (gx, gy) => {
    const c = Math.min(Math.floor(gx / cell), GRID - 1);
    const r = Math.min(Math.floor(gy / cell), GRID - 1);
    const dx = gx - c * cell;
    const dy = gy - r * cell;

    const nodeCol = Math.round(gx / cell);
    const nodeRow = Math.round(gy / cell);
    const nx = nodeCol * cell;
    const ny = nodeRow * cell;
    if (Math.hypot(gx - nx, gy - ny) <= NODE_RADIUS + 4) {
      const newN = nodes.map(row => [...row]);
      newN[nodeRow][nodeCol] = nextNodeState(newN[nodeRow][nodeCol]);
      setNodes(newN);
      return;
    }

    const distLeft = dx;
    const distRight = cell - dx;
    const distTop = dy;
    const distBottom = cell - dy;
    const min = Math.min(distLeft, distRight, distTop, distBottom);
    if (min <= EDGE_SNAP) {
      const newH = horizontal.map(row => [...row]);
      const newV = vertical.map(row => [...row]);
      if (min === distTop) newH[r][c] = nextEdgeState(newH[r][c]);
      else if (min === distBottom) newH[r + 1][c] = nextEdgeState(newH[r + 1][c]);
      else if (min === distLeft) newV[r][c] = nextEdgeState(newV[r][c]);
      else if (min === distRight) newV[r][c + 1] = nextEdgeState(newV[r][c + 1]);
      setHorizontal(newH);
      setVertical(newV);
    }
  };

  const handleWheel = e => {
    e.preventDefault();
    setScale(s => Math.min(5, Math.max(0.5, s * (e.deltaY < 0 ? 1.1 : 0.9))));
  };
  const handleMouseDown = e => {
    setDown({ x: e.clientX, y: e.clientY });
    setDrag({ x: e.clientX, y: e.clientY, startX: offset.x, startY: offset.y });
  };
  const handleMouseMove = e => {
    if (drag)
      setOffset({
        x: drag.startX + (e.clientX - drag.x),
        y: drag.startY + (e.clientY - drag.y)
      });
  };
  const handleMouseUp = e => {
    setDrag(null);
    if (down) {
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (moved <= TAP_MAX) {
        const { x, y } = toGrid(e.clientX, e.clientY);
        toggleAt(x, y);
      }
    }
    setDown(null);
  };

  const distance = (t1, t2) =>
    Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

  const handleTouchStart = e => {
    if (e.touches.length === 2) {
      setLastPinch({ dist: distance(e.touches[0], e.touches[1]), scale });
    } else if (e.touches.length === 1) {
      setDown({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      setDrag({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        startX: offset.x,
        startY: offset.y
      });
    }
  };
  const handleTouchMove = e => {
    if (e.touches.length === 2 && lastPinch) {
      const d = distance(e.touches[0], e.touches[1]);
      setScale(Math.min(5, Math.max(0.5, lastPinch.scale * (d / lastPinch.dist))));
    } else if (e.touches.length === 1 && drag) {
      setOffset({
        x: drag.startX + (e.touches[0].clientX - drag.x),
        y: drag.startY + (e.touches[0].clientY - drag.y)
      });
    }
  };
  const handleTouchEnd = e => {
    if (e.touches.length < 2) setLastPinch(null);
    if (e.touches.length === 0) {
      setDrag(null);
      setDown(null);
    }
  };

  return (
    <div className="wrapper" style={{ flexDirection: "column", gap: "10px" }}>
      <canvas
        ref={miniCanvasRef}
        width={SIZE}
        height={SIZE}
        className="mini-canvas"
        onMouseDown={e => {
          const { x, y } = toGrid(e.clientX, e.clientY, miniCanvasRef);
          toggleAt(x, y);
        }}
        onTouchStart={e => {
          const t = e.touches[0];
          const { x, y } = toGrid(t.clientX, t.clientY, miniCanvasRef);
          toggleAt(x, y);
        }}
      />
      <canvas
        ref={mainCanvasRef}
        width={SIZE}
        height={SIZE}
        className="base-canvas"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  );
}
