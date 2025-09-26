import { useRef, useEffect, useState } from "react";
import "./App.css";

const SIZE = 400;
const GRID = 10;
const LENS_DIAM = 225;   // +50% rispetto a prima
const ZOOM = 3;          // ingrandimento 3x
const EDGE_SNAP = 10;
const NODE_RADIUS = 6;
const EDGE_END_GAP = 0.1;

export default function App() {
  const baseRef = useRef(null);
  const srcRef  = useRef(null);
  const lensRef = useRef(null);

  const [showLens, setShowLens] = useState(true);          // lente sempre visibile
  const [lensPos, setLensPos]   = useState({ x: 0, y: 0 });

  // 0=default,1=rosso,2=verde
  const [horizontal, setHorizontal] = useState(
    Array.from({ length: GRID + 1 }, () => Array(GRID).fill(0))
  );
  const [vertical, setVertical] = useState(
    Array.from({ length: GRID }, () => Array(GRID + 1).fill(0))
  );

  // nodi: 0=nessuno,1=cerchio pieno viola,2=cerchio solo contorno
  const [nodes, setNodes] = useState(
    Array.from({ length: GRID + 1 }, () => Array(GRID + 1).fill(0))
  );

  const cell = SIZE / GRID;

  // ---------------- Disegno griglia, bordi, nodi ----------------
  const drawGridWithState = (ctx, h = horizontal, v = vertical, n = nodes) => {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.font = `${cell * 0.35}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // griglia base + numeri
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const x = c * cell;
        const y = r * cell;
        ctx.strokeRect(x, y, cell, cell);
        ctx.fillText(r * GRID + c + 1, x + cell / 2, y + cell / 2);
      }
    }

    // bordi orizzontali con gap 10%
    for (let r = 0; r <= GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        if (h[r][c] !== 0) {
          const x1 = c * cell + cell * EDGE_END_GAP;
          const x2 = (c + 1) * cell - cell * EDGE_END_GAP;
          const y  = r * cell;
          ctx.beginPath();
          ctx.strokeStyle = h[r][c] === 1 ? "red" : "green";
          ctx.lineWidth = 4;
          ctx.moveTo(x1, y);
          ctx.lineTo(x2, y);
          ctx.stroke();
        }
      }
    }

    // bordi verticali con gap 10%
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c <= GRID; c++) {
        if (v[r][c] !== 0) {
          const y1 = r * cell + cell * EDGE_END_GAP;
          const y2 = (r + 1) * cell - cell * EDGE_END_GAP;
          const x  = c * cell;
          ctx.beginPath();
          ctx.strokeStyle = v[r][c] === 1 ? "red" : "green";
          ctx.lineWidth = 4;
          ctx.moveTo(x, y1);
          ctx.lineTo(x, y2);
          ctx.stroke();
        }
      }
    }

    // nodi
    for (let r = 0; r <= GRID; r++) {
      for (let c = 0; c <= GRID; c++) {
        if (n[r][c] !== 0) {
          const x = c * cell;
          const y = r * cell;
          ctx.beginPath();
          if (n[r][c] === 1) {
            ctx.fillStyle = "purple";
            ctx.arc(x, y, NODE_RADIUS, 0, Math.PI * 2);
            ctx.fill();
          } else if (n[r][c] === 2) {
            ctx.strokeStyle = "purple";
            ctx.lineWidth = 2;
            ctx.arc(x, y, NODE_RADIUS, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    }
  };

  const redrawBoth = (h = horizontal, v = vertical, n = nodes) => {
    drawGridWithState(srcRef.current.getContext("2d"), h, v, n);
    drawGridWithState(baseRef.current.getContext("2d"), h, v, n);
  };

  useEffect(() => { redrawBoth(); }, []);
  useEffect(() => { redrawBoth(); }, [horizontal, vertical, nodes]);

  // ---------- lente ----------
  const refreshLensView = (x, y, h = horizontal, v = vertical, n = nodes) => {
    const bctx = baseRef.current.getContext("2d");
    drawGridWithState(bctx, h, v, n);
    bctx.save();
    bctx.globalCompositeOperation = "destination-out";
    bctx.beginPath();
    bctx.arc(x, y, LENS_DIAM / 2, 0, Math.PI * 2);
    bctx.fill();
    bctx.restore();

    const lctx = lensRef.current.getContext("2d");
    lctx.clearRect(0, 0, LENS_DIAM, LENS_DIAM);
    lctx.save();
    lctx.beginPath();
    lctx.arc(LENS_DIAM / 2, LENS_DIAM / 2, LENS_DIAM / 2, 0, Math.PI * 2);
    lctx.clip();
    lctx.drawImage(
      srcRef.current,
      x - LENS_DIAM / (2 * ZOOM),
      y - LENS_DIAM / (2 * ZOOM),
      LENS_DIAM / ZOOM,
      LENS_DIAM / ZOOM,
      0, 0, LENS_DIAM, LENS_DIAM
    );
    lctx.restore();

    lensRef.current.style.left = `${x - LENS_DIAM / 2}px`;
    lensRef.current.style.top  = `${y - LENS_DIAM / 2}px`;
  };

  // ⬇️ LOG AGGIUNTI QUI
  const handleMove = (e) => {
    const rect = baseRef.current.getBoundingClientRect();
    console.log('Bounding rect:', rect);
    console.log('Client coords:', e.clientX, e.clientY);
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    console.log('Canvas coords:', x, y);

    setLensPos({ x, y });
    refreshLensView(x, y);
  };

  // mappa un click all’interno della lente alle coordinate reali della griglia
  const pickPoint = (x, y) => {
    if (!showLens) return { px: x, py: y };
    const dx = x - lensPos.x;
    const dy = y - lensPos.y;
    const r  = LENS_DIAM / 2;
    if (dx * dx + dy * dy > r * r) return { px: x, py: y };
    return {
      px: lensPos.x + dx / ZOOM,
      py: lensPos.y + dy / ZOOM,
    };
  };

  const nextEdgeState = v => (v + 1) % 3; // 0→1→2→0
  const nextNodeState = v => (v + 1) % 3; // 0→1→2→0

  const handleClick = (e) => {
    const rect = baseRef.current.getBoundingClientRect();
    const xRel = e.clientX - rect.left;
    const yRel = e.clientY - rect.top;

    // 🔑 se si clicca dentro la lente, converte le coordinate
    const { px, py } = pickPoint(xRel, yRel);

    const c = Math.min(Math.floor(px / cell), GRID - 1);
    const r = Math.min(Math.floor(py / cell), GRID - 1);

    const dx = px - c * cell;
    const dy = py - r * cell;

    // prima: nodo
    let nodeHandled = false;
    const nodeCol = Math.round(px / cell);
    const nodeRow = Math.round(py / cell);
    const nx = nodeCol * cell;
    const ny = nodeRow * cell;
    if (Math.hypot(px - nx, py - ny) <= NODE_RADIUS + 4) {
      const newNodes = nodes.map(row => [...row]);
      newNodes[nodeRow][nodeCol] = nextNodeState(newNodes[nodeRow][nodeCol]);
      setNodes(newNodes);
      nodeHandled = true;
    }

    if (!nodeHandled) {
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
    }

    // micro-move per aggiornare la lente immediatamente
    setLensPos(prev => {
      const fake = { x: prev.x + 1, y: prev.y + 1 };
      refreshLensView(fake.x, fake.y, horizontal, vertical, nodes);
      requestAnimationFrame(() =>
        refreshLensView(prev.x, prev.y, horizontal, vertical, nodes)
      );
      return prev;
    });
  };

  return (
    <div
      className="wrapper"
      onMouseMove={handleMove}
      onMouseEnter={() => setShowLens(true)}
      onClick={handleClick}

      // supporto touch drag
      onTouchStart={(e) => {
        const t = e.touches[0];
        const rect = baseRef.current.getBoundingClientRect();
        const x = t.clientX - rect.left;
        const y = t.clientY - rect.top;
        setLensPos({ x, y });
        refreshLensView(x, y);
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        const rect = baseRef.current.getBoundingClientRect();
        const x = t.clientX - rect.left;
        const y = t.clientY - rect.top;
        setLensPos({ x, y });
        refreshLensView(x, y);
      }}
    >
      <canvas ref={baseRef} width={SIZE} height={SIZE} className="base-canvas" />
      <canvas ref={srcRef}  width={SIZE} height={SIZE} className="hidden-canvas" />
      {showLens && (
        <canvas
          ref={lensRef}
          width={LENS_DIAM}
          height={LENS_DIAM}
          className="lens-canvas"
        />
      )}
    </div>
  );
}
