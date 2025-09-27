import { useRef, useEffect, useState } from "react";
import "./App.css";

const INNER = 10;
const BORDER = 1;
const GRID = INNER + 2 * BORDER;   // totale 12
const SIZE = 480;
const NODE_RADIUS = 6;
const EDGE_END_GAP = 0.02;         // 96% di lunghezza
const EDGE_SNAP = 14;

export default function App() {
  const canvasRef = useRef(null);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState(null);
  const [down, setDown] = useState(null);
  const [lastPinch, setLastPinch] = useState(null);
  const TAP_MAX = 6;

  // --- stato iniziale: contorno 10x10 interno attivo ---
  const initHorizontal = Array.from({ length: GRID + 1 }, () => Array(GRID).fill(0));
  const initVertical   = Array.from({ length: GRID }, () => Array(GRID + 1).fill(0));
  for (let c = BORDER; c < GRID - BORDER; c++) {
    initHorizontal[BORDER][c]        = 1;
    initHorizontal[GRID - BORDER][c] = 1;
  }
  for (let r = BORDER; r < GRID - BORDER; r++) {
    initVertical[r][BORDER]          = 1;
    initVertical[r][GRID - BORDER]   = 1;
  }
  const initNodes = Array.from({ length: GRID + 1 }, () => Array(GRID + 1).fill(0));
  initNodes[BORDER][BORDER]               = 1;
  initNodes[BORDER][GRID - BORDER]        = 1;
  initNodes[GRID - BORDER][BORDER]        = 1;
  initNodes[GRID - BORDER][GRID - BORDER] = 1;

  const [horizontal, setHorizontal] = useState(initHorizontal);
  const [vertical,   setVertical]   = useState(initVertical);
  const [nodes,      setNodes]      = useState(initNodes);

  const cell = SIZE / GRID;

  // ---------- Disegno ----------
  const draw = () => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.save();
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.scale(scale, scale);
    ctx.translate(offset.x / scale, offset.y / scale);

    // griglia interna sottile
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

    // bordi attivi
    const gap = cell * EDGE_END_GAP;
    for (let r = 0; r <= GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const s = horizontal[r][c];
        if (!s) continue;
        if (r < BORDER || r > GRID - BORDER || c < BORDER || c >= GRID - BORDER) continue;
        const x1 = c * cell + gap;
        const x2 = (c + 1) * cell - gap;
        const y  = r * cell;
        ctx.beginPath();
        ctx.strokeStyle = s === 1 ? "black" : "#555";
        ctx.lineWidth   = s === 1 ? 4 : 2;
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
        if (s === 2) {
          ctx.beginPath();
          ctx.strokeStyle = "black";
          ctx.lineWidth = 2;
          ctx.moveTo((x1 + x2) / 2 - 5, y - 5);
          ctx.lineTo((x1 + x2) / 2 + 5, y + 5);
          ctx.stroke();
        }
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
        ctx.strokeStyle = s === 1 ? "black" : "#555";
        ctx.lineWidth   = s === 1 ? 4 : 2;
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
        ctx.stroke();
        if (s === 2) {
          ctx.beginPath();
          ctx.strokeStyle = "black";
          ctx.lineWidth = 2;
          ctx.moveTo(x - 5, (y1 + y2) / 2 - 5);
          ctx.lineTo(x + 5, (y1 + y2) / 2 + 5);
          ctx.stroke();
        }
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
    ctx.restore();
  };

  useEffect(() => { draw(); }, [scale, offset, horizontal, vertical, nodes]);

  const nextEdgeState = v => (v + 1) % 3;
  const nextNodeState = v => (v + 1) % 3;

  // --- conversione coordinate, corretta per ogni scala CSS ---
  const toGrid = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width  / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX / scale - offset.x / scale,
      y: (clientY - rect.top)  * scaleY / scale - offset.y / scale
    };
  };

  const toggleAt = (gx, gy) => {
    const c = Math.min(Math.floor(gx / cell), GRID - 1);
    const r = Math.min(Math.floor(gy / cell), GRID - 1);
    const dx = gx - c * cell;
    const dy = gy - r * cell;

    // nodo
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

    // bordo
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

  // --- zoom e pan mouse ---
  const handleWheel = e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setScale(s => Math.min(5, Math.max(0.5, s * factor)));
  };
  const handleMouseDown = e => {
    setDown({ x: e.clientX, y: e.clientY });
    setDrag({ x: e.clientX, y: e.clientY, startX: offset.x, startY: offset.y });
  };
  const handleMouseMove = e => {
    if (drag) {
      setOffset({
        x: drag.startX + (e.clientX - drag.x),
        y: drag.startY + (e.clientY - drag.y)
      });
    }
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

  // --- pinch-to-zoom mobile ---
  const distance = (t1, t2) =>
    Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

  const handleTouchStart = e => {
    if (e.touches.length === 2) {
      const d = distance(e.touches[0], e.touches[1]);
      setLastPinch({ dist: d, scale });
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
      const factor = d / lastPinch.dist;
      setScale(Math.min(5, Math.max(0.5, lastPinch.scale * factor)));
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
    <div
      className="wrapper"
      style={{
        touchAction: "none",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh"
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        className="base-canvas"
        style={{ touchAction: "none" }}
      />
    </div>
  );
}
