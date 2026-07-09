import { describe, expect, it, vi } from 'vitest';

import { numberField } from './settingsPanel.js';

describe('numberField', () => {
  it('maps numeric choices to string-valued segmented choices', () => {
    const field = numberField('rounds', 'Questions', 10, [5, 10, 20], () => {});
    expect(field.id).toBe('rounds');
    expect(field.value).toBe('10');
    expect(field.choices).toEqual([
      { label: '5', value: '5' },
      { label: '10', value: '10' },
      { label: '20', value: '20' },
    ]);
  });

  it('formats labels while keeping numeric string values', () => {
    const field = numberField(
      'time',
      'Time',
      60,
      [30, 60],
      () => {},
      (n) => `${n}s`
    );
    expect(field.choices).toEqual([
      { label: '30s', value: '30' },
      { label: '60s', value: '60' },
    ]);
  });

  it('parses the picked value back to a number before calling onChange', () => {
    const onChange = vi.fn();
    const field = numberField('lives', 'Lives', 3, [1, 3, 5], onChange);
    field.onChange('5');
    expect(onChange).toHaveBeenCalledWith(5);
    expect(typeof onChange.mock.calls[0][0]).toBe('number');
  });
});
