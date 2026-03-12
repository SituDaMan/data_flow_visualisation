import React, { useEffect, useMemo, useRef, useState } from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';

const e = React.createElement;
const STORAGE_KEY = 'data-flow-visualiser-input';
const POSITIONS_KEY = 'data-flow-visualiser-node-positions';
const SAMPLE_INPUT = `Customer Profile: CRM > API Gateway > Data Lake > Analytics\nOrder Events: Commerce Platform > API Gateway > Fraud Engine > Data Lake\nBilling Feed: Billing Core > Integration Hub > Data Lake > Finance BI`;
const COLORS = ['#1A73E8', '#34A853', '#FBBC05', '#EA4335', '#8E24AA', '#0097A7'];
const NODE = { width: 160, height: 64 };
const WORLD = { minX: -2800, maxX: 2800, minY: -2800, maxY: 2800, originX: 3000, originY: 3000, width: 6000, height: 6000 };

const parseFlows = (text) => text.split('\n').map((l, i) => {
  const [label, chain] = l.split(':');
  if (!chain) return null;
  const systems = chain.split('>').map((s) => s.trim()).filter(Boolean);
  if (systems.length < 2) return null;
  return { id: i, label: label.trim(), systems };
}).filter(Boolean);

const makePositions = (names) => names.reduce((acc, name, i) => {
  const cols = Math.max(2, Math.ceil(Math.sqrt(names.length)));
  acc[name] = { x: 80 + (i % cols) * 280, y: 80 + Math.floor(i / cols) * 140 };
  return acc;
}, {});

const readStoredPositions = () => {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

function App() {
  const [input, setInput] = useState(() => localStorage.getItem(STORAGE_KEY) || SAMPLE_INPUT);
  const [saveState, setSaveState] = useState('saved');
  const flows = useMemo(() => parseFlows(input), [input]);
  const nodes = useMemo(() => [...new Set(flows.flatMap((f) => f.systems))], [flows]);
  const [positions, setPositions] = useState(() => readStoredPositions());
  const dragRef = useRef(null);
  const panRef = useRef(null);
  const canvasRef = useRef(null);
  const [viewport, setViewport] = useState({ x: -2960, y: -2960, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);

  const toWorldPoint = (clientX, clientY, currentViewport = viewport) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return {
      x: ((clientX - bounds.left - currentViewport.x) / currentViewport.scale) - WORLD.originX,
      y: ((clientY - bounds.top - currentViewport.y) / currentViewport.scale) - WORLD.originY,
    };
  };

  useEffect(() => {
    setSaveState('saving');
    const timer = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, input);
      setSaveState('saved');
    }, 350);

    return () => window.clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [positions]);

  useEffect(() => {
    setPositions((prev) => {
      const base = makePositions(nodes);
      const next = {};
      nodes.forEach((n) => { next[n] = prev[n] || base[n]; });
      return next;
    });
  }, [nodes]);
  useEffect(() => {
    const move = (event) => {
      if (dragRef.current) {
        const pointerWorld = toWorldPoint(event.clientX, event.clientY);
        const { node, dx, dy } = dragRef.current;
        const x = Math.max(WORLD.minX, Math.min(pointerWorld.x - dx, WORLD.maxX - NODE.width));
        const y = Math.max(WORLD.minY, Math.min(pointerWorld.y - dy, WORLD.maxY - NODE.height));
        setPositions((prev) => ({ ...prev, [node]: { x, y } }));
      }

      if (panRef.current) {
        const nextX = panRef.current.originX + (event.clientX - panRef.current.startX);
        const nextY = panRef.current.originY + (event.clientY - panRef.current.startY);
        setViewport((prev) => ({ ...prev, x: nextX, y: nextY }));
      }
    };

    const up = () => {
      dragRef.current = null;
      panRef.current = null;
      setIsPanning(false);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [viewport]);

  const edges = flows.flatMap((f, i) => f.systems.slice(0, -1).map((s, j) => ({
    key: `${f.id}-${j}`,
    from: s,
    to: f.systems[j + 1],
    label: f.label,
    color: COLORS[i % COLORS.length],
    idx: j,
  })));

  return e('div', { className: 'app-shell' },
    e('header', { className: 'top-bar' },
      e('h1', null, 'Data Flow Visualiser'),
      e('p', null, 'Material-inspired architecture map with draggable systems and colour-coded entities.'),
    ),
    e('main', { className: 'layout' },
      e('section', { className: 'input-panel' },
        e('h2', null, 'Flow Definition'),
        e('p', { className: 'hint' }, 'Format: Entity Name: System A > System B > System C'),
        e('textarea', { value: input, onChange: (ev) => setInput(ev.target.value), spellCheck: false }),
        e('div', {
          className: `save-status ${saveState === 'saving' ? 'is-saving' : 'is-saved'}`,
          role: 'status',
          'aria-live': 'polite',
        },
        e('span', { className: 'save-icon', 'aria-hidden': 'true' }),
        e('span', null, saveState === 'saving' ? 'Saving changes…' : 'All changes saved'),
        ),
      ),
      e('section', {
        className: `canvas-panel ${isPanning ? 'is-panning' : ''}`,
        ref: canvasRef,
        onContextMenu: (ev) => ev.preventDefault(),
        onPointerDown: (ev) => {
          if (ev.button !== 2) return;
          ev.preventDefault();
          setIsPanning(true);
          panRef.current = {
            startX: ev.clientX,
            startY: ev.clientY,
            originX: viewport.x,
            originY: viewport.y,
          };
        },
        onWheel: (ev) => {
          ev.preventDefault();
          const zoomFactor = Math.exp(-ev.deltaY * 0.0015);
          const nextScale = Math.max(0.4, Math.min(viewport.scale * zoomFactor, 2.5));
          const pointerBefore = toWorldPoint(ev.clientX, ev.clientY, viewport);
          const bounds = canvasRef.current?.getBoundingClientRect();
          if (!bounds) return;
          const nextX = ev.clientX - bounds.left - ((pointerBefore.x + WORLD.originX) * nextScale);
          const nextY = ev.clientY - bounds.top - ((pointerBefore.y + WORLD.originY) * nextScale);
          setViewport({ x: nextX, y: nextY, scale: nextScale });
        },
      },
      e('div', {
        className: 'viewport',
        style: { transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` },
      },
      e('svg', { className: 'flow-layer', width: WORLD.width, height: WORLD.height },
        e('defs', null,
          ...COLORS.map((c) => e('marker', { key: c, id: `arrow-${c.slice(1)}`, markerWidth: 10, markerHeight: 8, refX: 8, refY: 4, orient: 'auto' },
            e('path', { d: 'M0,0 L0,8 L9,4 z', fill: c }),
          )),
        ),
        ...edges.map((edge) => {
          const from = positions[edge.from];
          const to = positions[edge.to];
          if (!from || !to) return null;
          const sx = from.x + WORLD.originX + NODE.width;
          const sy = from.y + WORLD.originY + (NODE.height / 2);
          const ex = to.x + WORLD.originX;
          const ey = to.y + WORLD.originY + (NODE.height / 2);
          const c = Math.max(36, Math.abs(ex - sx) / 2);
          const d = `M ${sx} ${sy} C ${sx + c} ${sy}, ${ex - c} ${ey}, ${ex} ${ey}`;
          return e('g', { key: edge.key },
            e('path', { d, stroke: edge.color, strokeWidth: 3, fill: 'none', markerEnd: `url(#arrow-${edge.color.slice(1)})` }),
            e('text', {
              x: (sx + ex) / 2,
              y: (sy + ey) / 2 - 10 - edge.idx * 12,
              fill: edge.color,
              className: 'edge-label',
              textAnchor: 'middle',
            }, edge.label),
          );
        }),
      ),
      e('div', { className: 'nodes-layer' },
        ...nodes.map((name) => {
          const pos = positions[name] || { x: 12, y: 12 };
          return e('button', {
            key: name,
            className: 'node',
            type: 'button',
            style: { transform: `translate(${pos.x + WORLD.originX}px, ${pos.y + WORLD.originY}px)` },
            onPointerDown: (ev) => {
              if (ev.button !== 0) return;
              const pointerWorld = toWorldPoint(ev.clientX, ev.clientY);
              dragRef.current = {
                node: name,
                dx: pointerWorld.x - pos.x,
                dy: pointerWorld.y - pos.y,
              };
            },
          }, name);
        }),
      ),
      ),
      e('div', { className: 'canvas-help' }, 'Right-click + drag to pan. Scroll to zoom.'),
      ),
    ),
  );
}

createRoot(document.getElementById('root')).render(e(App));
