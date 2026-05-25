import { extractContentItemId, mergeAlignedSemanticBlockContent } from '../albumDetailListItemId';

describe('mergeAlignedSemanticBlockContent', () => {
  it('keeps localized item by id when source removes another entity', () => {
    const existing = [
      { id: 'a', text: ['zhoock1', 'guitar1'] },
      { id: 'b', text: ['zhoock2', 'guitar2'] },
    ];
    const source = [{ id: 'b', text: ['zhoock2', 'guitar2'] }];

    const merged = mergeAlignedSemanticBlockContent(existing, source);

    expect(merged).toHaveLength(1);
    expect(extractContentItemId(merged[0])).toBe('b');
    expect(merged[0]).toEqual({ id: 'b', text: ['zhoock2', 'guitar2'] });
  });

  it('preserves target locale text for surviving ids', () => {
    const existing = [
      { id: 'a', text: ['Исполнитель RU', 'роль RU'] },
      { id: 'b', text: ['Другой RU', 'роль 2'] },
    ];
    const source = [
      { id: 'b', text: ['Other EN', 'role 2'] },
      { id: 'c', text: ['New EN', 'role 3'] },
    ];

    const merged = mergeAlignedSemanticBlockContent(existing, source);

    expect(merged).toHaveLength(2);
    expect(merged[0]).toEqual({ id: 'b', text: ['Другой RU', 'роль 2'] });
    expect(merged[1]).toEqual({ id: 'c', text: ['New EN', 'role 3'] });
  });

  it('migrates legacy rows without id using source order', () => {
    const existing = ['legacy-one', 'legacy-two'];
    const source = [
      { id: 'x', text: ['one EN', 'role'] },
      { id: 'y', text: ['two EN', 'role'] },
    ];

    const merged = mergeAlignedSemanticBlockContent(existing, source);

    expect(merged).toHaveLength(2);
    expect(extractContentItemId(merged[0])).toBe('x');
    expect(merged[0]).toEqual({ id: 'x', text: 'legacy-one' });
    expect(extractContentItemId(merged[1])).toBe('y');
    expect(merged[1]).toEqual({ id: 'y', text: 'legacy-two' });
  });
});
