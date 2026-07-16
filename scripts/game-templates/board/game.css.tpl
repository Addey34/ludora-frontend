@import url('../global.css');

:root {
  --title-color: var(--color-{{key}});
}

.{{key}}-board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--surface-1);
  border: 1px solid var(--line);
  border-radius: var(--border-radius-lg);
}

.{{key}}-cell {
  aspect-ratio: 1;
  border: 1px solid var(--line);
  border-radius: var(--border-radius-md);
  background: var(--surface-2);
  color: var(--text);
  font: inherit;
  font-size: clamp(2rem, 12vw, 5rem);
  font-weight: 800;
  cursor: pointer;
}

.{{key}}-cell:disabled {
  cursor: default;
}

.{{key}}-cell.is-seat-0 {
  color: var(--color-{{key}});
}

.{{key}}-cell.is-seat-1 {
  color: var(--accent);
}
