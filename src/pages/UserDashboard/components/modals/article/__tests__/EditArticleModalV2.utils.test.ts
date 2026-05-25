import {
  blocksToDetails,
  createListItem,
  generateId,
  normalizeDetailsToBlocks,
} from '../EditArticleModalV2.utils';

describe('EditArticleModalV2.utils stable ids', () => {
  it('persists blockId and list item ids through save/load roundtrip', () => {
    const blockId = generateId();
    const itemA = createListItem('First');
    const itemB = createListItem('Second');
    itemA.id = 'item-a';
    itemB.id = 'item-b';

    const blocks = [
      { id: blockId, type: 'title' as const, text: 'Section title' },
      { id: generateId(), type: 'list' as const, items: [itemA, itemB] },
    ];

    const details = blocksToDetails(blocks);
    expect(details[0].blockId).toBe(blockId);
    expect(details[0].blockKind).toBe('title');
    expect(details[1].blockKind).toBe('list');
    expect(details[1].content).toEqual([
      { id: 'item-a', text: 'First' },
      { id: 'item-b', text: 'Second' },
    ]);

    const loaded = normalizeDetailsToBlocks(details);
    expect(loaded[0].id).toBe(blockId);
    expect(loaded[1].type).toBe('list');
    if (loaded[1].type === 'list') {
      expect(loaded[1].items).toEqual([
        { id: 'item-a', text: 'First' },
        { id: 'item-b', text: 'Second' },
      ]);
    }
  });

  it('migrates legacy string list items to stable ids on load', () => {
    const listBlockId = generateId();
    const loaded = normalizeDetailsToBlocks([
      {
        type: 'text',
        blockId: listBlockId,
        blockKind: 'list',
        content: ['Alpha', 'Beta'],
      },
    ]);

    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(listBlockId);
    if (loaded[0].type !== 'list') throw new Error('expected list block');
    expect(loaded[0].items).toHaveLength(2);
    expect(loaded[0].items[0].text).toBe('Alpha');
    expect(loaded[0].items[1].text).toBe('Beta');
    expect(loaded[0].items[0].id).toEqual(expect.any(String));
    expect(loaded[0].items[1].id).toEqual(expect.any(String));
  });

  it('stores one details row per block with blockId', () => {
    const paragraphId = generateId();
    const quoteId = generateId();
    const details = blocksToDetails([
      { id: paragraphId, type: 'paragraph', text: 'Body' },
      { id: quoteId, type: 'quote', text: 'Quote text' },
    ]);

    expect(details).toHaveLength(2);
    expect(details[0]).toMatchObject({
      blockId: paragraphId,
      blockKind: 'paragraph',
      content: 'Body',
    });
    expect(details[1]).toMatchObject({
      blockId: quoteId,
      blockKind: 'quote',
      content: 'Quote text',
    });
  });

  it('assigns ids to pasted list lines', () => {
    const details = blocksToDetails([
      {
        id: generateId(),
        type: 'list',
        items: ['One', 'Two', 'Three'].map((text) => createListItem(text)),
      },
    ]);

    const content = details[0].content;
    expect(Array.isArray(content)).toBe(true);
    if (!Array.isArray(content)) return;
    expect(content).toHaveLength(3);
    for (const item of content) {
      expect(typeof item).toBe('object');
      if (typeof item === 'string') throw new Error('expected object item');
      expect(item.id).toEqual(expect.any(String));
    }
  });
});
