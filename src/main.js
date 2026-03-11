import React, { useEffect, useMemo, useRef, useState } from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';

const e = React.createElement;
const SAMPLE_INPUT = `Customer Profile: CRM > API Gateway > Data Lake > Analytics\nOrder Events: Commerce Platform > API Gateway > Fraud Engine > Data Lake\nBilling Feed: Billing Core > Integration Hub > Data Lake > Finance BI`;
const COLORS = ['#1A73E8', '#34A853', '#FBBC05', '#EA4335', '#8E24AA', '#0097A7'];
const NODE = { width: 160, height: 64 };

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

function App() {
  const [input, setInput] = useState(SAMPLE_INPUT);
  const flows = useMemo(() => parseFlows(input), [input]);
  const nodes = useMemo(() => [...new Set(flows.flatMap((f) => f.systems))], [flows]);
  const [positions, setPositions] = useState(() => makePositions(nodes));
  const dragRef = useRef(null);
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ width: 900, height: 620 });

  useEffect(() => {
    setPositions((prev) => {
      const base = makePositions(nodes);
      const next = {};
      nodes.forEach((n) => { next[n] = prev[n] || base[n]; });
      return next;
    });
  }, [nodes]);

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setSize({ width: Math.max(680, r.width), height: Math.max(500, r.height) });
    });
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const move = (event) => {
      if (!dragRef.current || !canvasRef.current) return;
      const b = canvasRef.current.getBoundingClientRect();
      const { node, dx, dy } = dragRef.current;
      const x = Math.max(12, Math.min(event.clientX - b.left - dx, size.width - NODE.width - 12));
      const y = Math.max(12, Math.min(event.clientY - b.top - dy, size.height - NODE.height - 12));
      setPositions((prev) => ({ ...prev, [node]: { x, y } }));
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [size]);

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
      ),
      e('section', { className: 'canvas-panel', ref: canvasRef },
        e('svg', { className: 'flow-layer', width: size.width, height: size.height },
          e('defs', null,
            ...COLORS.map((c) => e('marker', { key: c, id: `arrow-${c.slice(1)}`, markerWidth: 10, markerHeight: 8, refX: 8, refY: 4, orient: 'auto' },
              e('path', { d: 'M0,0 L0,8 L9,4 z', fill: c }),
            )),
          ),
          ...edges.map((edge) => {
            const from = positions[edge.from];
            const to = positions[edge.to];
            if (!from || !to) return null;
            const sx = from.x + NODE.width;
            const sy = from.y + NODE.height / 2;
            const ex = to.x;
            const ey = to.y + NODE.height / 2;
            const c = Math.max(36, Math.abs(ex - sx) / 2);
            const d = `M ${sx} ${sy} C ${sx + c} ${sy}, ${ex - c} ${ey}, ${ex} ${ey}`;
            return e('g', { key: edge.key },
              e('path', { d, stroke: edge.color, strokeWidth: 3, fill: 'none', markerEnd: `url(#arrow-${edge.color.slice(1)})` }),
              e('text', { x: (sx + ex) / 2, y: (sy + ey) / 2 - 10 - edge.idx * 12, fill: edge.color, className: 'edge-label' }, edge.label),
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
              style: { transform: `translate(${pos.x}px, ${pos.y}px)` },
              onPointerDown: (ev) => {
                const b = ev.currentTarget.getBoundingClientRect();
                dragRef.current = { node: name, dx: ev.clientX - b.left, dy: ev.clientY - b.top };
              },
            }, name);
          }),
        ),
      ),
    ),
  );
}

createRoot(document.getElementById('root')).render(e(App));
