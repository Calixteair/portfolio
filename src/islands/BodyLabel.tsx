import { forwardRef } from 'react';

/**
 * Label of the body under the pointer (SPEC §5.7): title and one-line summary. Positioned
 * every frame from the 3D side through CSSOM (allowed by the strict CSP); hidden until a
 * body is hovered. Decorative for assistive tech: the keyboard list carries the same text.
 */
const BodyLabel = forwardRef<HTMLDivElement>(function BodyLabel(_, ref) {
  return (
    <div ref={ref} className="body-label" aria-hidden="true" hidden>
      <strong className="body-label-title" />
      <span className="body-label-summary" />
    </div>
  );
});

export default BodyLabel;
