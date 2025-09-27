import { useRef, useEffect, useState } from "react";
import "./App.css";

const SIZE = 400;
const GRID = 10;
const LENS_DIAM = 225;
const ZOOM = 3;
const EDGE_SNAP = 10;
const NODE_RADIUS = 6;
const EDGE_END_GAP = 0.1;

export default function App() {
  const baseRef = useRef(null);
  const srcRef  = useRef(null);
  const lensRef = useRef(null);

  const [showLens, setShowLens] = useState(true);
  const [lensPos, setLensPos]   = useState({ x: 0, y: 0 });
  const [highlight, setHighlight] = useState(null);

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

  // Disegna la griglia principale
  const drawGridWithState = (ctx, h = horizontal, v = vertical, n = nodes) => {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.font = `${cell * 0.35}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

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

    // bordi orizzontali
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

    // bordi verticali
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

  // calcola l’elemento sotto il mirino
  const computeHighlight = (px, py) => {
    const c = Math.min(Math.floor(px / cell), GRID - 1);
    const r = Math.min(Math.floor(py / cell), GRID - 1);
    const dx = px - c * cell;
    const dy = py - r * cell;

    const nodeCol = Math.round(px / cell);
    const nodeRow = Math.round(py / cell);
    const nx = nodeCol * cell;
    const ny = nodeRow * cell;
    if (Math.hypot(px - nx, py - ny) <= NODE_RADIUS + 4) {
      return { type: "node", row: nodeRow, col: nodeCol };
    }

    const distLeft   = dx;
    const distRight  = cell - dx;
    const distTop    = dy;
    const distBottom = cell - dy;
    const min = Math.min(distLeft, distRight, distTop, distBottom);

    if (min <= EDGE_SNAP) {
      if (min === distTop)     return { type: "hEdge", row: r,   col: c };
      if (min === distBottom)  return { type: "hEdge", row: r+1, col: c };
      if (min === distLeft)    return { type: "vEdge", row: r,   col: c };
      if (min === distRight)   return { type: "vEdge", row: r,   col: c+1 };
    }
    return null;
  };

  // lente con evidenziazione
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

    // immagine ingrandita
    lctx.drawImage(
      srcRef.current,
      x - LENS_DIAM / (2 * ZOOM),
      y - LENS_DIAM / (2 * ZOOM),
      LENS_DIAM / ZOOM,
      LENS_DIAM / ZOOM,
      0, 0, LENS_DIAM, LENS_DIAM
    );

    // evidenziazione sopra l’immagine
    if (highlight) {
      lctx.save();
      lctx.strokeStyle = "cyan";
      lctx.lineWidth = 4;
      const scale = ZOOM;
      const offsetX = x - LENS_DIAM / (2 * ZOOM);
      const offsetY = y - LENS_DIAM / (2 * ZOOM);
      const toLensX = px => (px - offsetX) * scale;
      const toLensY = py => (py - offsetY) * scale;

      if (highlight.type === "node") {
        const cx = highlight.col * cell;
        const cy = highlight.row * cell;
        lctx.beginPath();
        lctx.arc(toLensX(cx), toLensY(cy), NODE_RADIUS * scale + 4, 0, Math.PI * 2);
        lctx.stroke();
      } else if (highlight.type === "hEdge") {
        const r = highlight.row;
        const c = highlight.col;
        const x1 = c * cell + cell * EDGE_END_GAP;
        const x2 = (c + 1) * cell - cell * EDGE_END_GAP;
        const yE = r * cell;
        lctx.beginPath();
        lctx.moveTo(toLensX(x1), toLensY(yE));
        lctx.lineTo(toLensX(x2), toLensY(yE));
        lctx.stroke();
      } else if (highlight.type === "vEdge") {
        const r = highlight.row;
        const c = highlight.col;
        const y1 = r * cell + cell * EDGE_END_GAP;
        const y2 = (r + 1) * cell - cell * EDGE_END_GAP;
        const xE = c * cell;
        lctx.beginPath();
        lctx.moveTo(toLensX(xE), toLensY(y1));
        lctx.lineTo(toLensX(xE), toLensY(y2));
        lctx.stroke();
      }
      lctx.restore();
    }

    lctx.restore();

   // === Icona mano (emoji) ===
const mid = LENS_DIAM / 2;
lctx.font = "36px sans-serif";      // dimensione regolabile
lctx.textAlign = "center";
lctx.textBaseline = "middle";
lctx.fillText("👉", mid, mid);


    lensRef.current.style.left = `${x - LENS_DIAM / 2}px`;
    lensRef.current.style.top  = `${y - LENS_DIAM / 2}px`;
  };

  const handleMove = (e) => {
    const rect = baseRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setLensPos({ x, y });
    setHighlight(computeHighlight(x, y));
    refreshLensView(x, y);
  };

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

  const nextEdgeState = v => (v + 1) % 3;
  const nextNodeState = v => (v + 1) % 3;

  const handleClick = (e) => {
    const rect = baseRef.current.getBoundingClientRect();
    const xRel = e.clientX - rect.left;
    const yRel = e.clientY - rect.top;
    const { px, py } = pickPoint(xRel, yRel);

    const c = Math.min(Math.floor(px / cell), GRID - 1);
    const r = Math.min(Math.floor(py / cell), GRID - 1);
    const dx = px - c * cell;
    const dy = py - r * cell;

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

    // micro-move per aggiornare subito la lente
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
      onTouchStart={(e) => {
        const t = e.touches[0];
        const rect = baseRef.current.getBoundingClientRect();
        const x = t.clientX - rect.left;
        const y = t.clientY - rect.top;
        setLensPos({ x, y });
        setHighlight(computeHighlight(x, y));
        refreshLensView(x, y);
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        const rect = baseRef.current.getBoundingClientRect();
        const x = t.clientX - rect.left;
        const y = t.clientY - rect.top;
        setLensPos({ x, y });
        setHighlight(computeHighlight(x, y));
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
