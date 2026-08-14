import { useRef, useEffect, useCallback } from 'react';

export function ResponsiveText({ text, className }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  const fit = useCallback(() => {
    const container = containerRef.current;
    const el = textRef.current;
    if (!container || !el) return;

    // getBoundingClientRect funciona mesmo com height:auto + max-height
    const containerHeight = container.getBoundingClientRect().height;
    if (containerHeight === 0) return;

    // Começa no máximo e vai reduzindo até caber
    let size = 20;
    el.style.fontSize = `${size}px`;

    while (size > 9 && el.scrollHeight > containerHeight) {
      size -= 1;
      el.style.fontSize = `${size}px`;
    }
  }, []);

  // Recalcula quando o texto muda
  useEffect(() => {
    fit();
  }, [text, fit]);

  // Recalcula quando o tamanho do container muda (ex: após responder)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      fit();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [fit]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        flexGrow: 1,
        minHeight: '60px',
        overflow: 'hidden',   // nunca mostra scrollbar
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <p
        ref={textRef}
        className={className}
        style={{
          margin: 0,
          transition: 'none',
          width: '100%',
        }}
      >
        {text}
      </p>
    </div>
  );
}
