@import url('../global.css');

:root {
  --title-color: var(--color-{{key}});
}

.{{key}}-board {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-template-rows: repeat(5, 1fr);
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--surface-1);
  border: 1px solid var(--line);
  border-radius: var(--border-radius-lg);
}

.{{key}}-player,
.{{key}}-target {
  width: 70%;
  height: 70%;
  place-self: center;
}

.{{key}}-player {
  background: var(--color-{{key}});
  border-radius: var(--border-radius-sm);
  box-shadow: var(--shadow-sm);
}

.{{key}}-target {
  background: var(--accent);
  border-radius: 50%;
}
