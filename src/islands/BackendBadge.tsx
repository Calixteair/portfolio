import type { Backend } from '../three/renderer';

/** Dev-only badge showing the active GPU backend. */
export default function BackendBadge({ backend }: { backend: Backend }) {
  return (
    <output
      style={{
        position: 'fixed',
        top: 8,
        left: 8,
        padding: '2px 8px',
        font: '12px/1.6 ui-monospace, monospace',
        color: backend === 'webgpu' ? '#b4e0ff' : '#ff5a14',
        background: 'rgb(0 0 0 / 0.6)',
        border: '1px solid currentColor',
        borderRadius: 4,
        pointerEvents: 'none',
      }}
    >
      {backend}
    </output>
  );
}
