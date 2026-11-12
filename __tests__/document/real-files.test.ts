import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildDocument, type DocumentResult } from '../../src/core/document/document';
import { summarizePage } from '../../src/core/document/page-summary';
import { readAllPages } from '../helpers/make-pdf';

// testFiles/ is git-ignored; these regression checks run only where the sample PDFs exist.
const INVOICE = 'testFiles/17768124-00.pdf';
const SAMPLE = 'testFiles/sample-tables.pdf';

async function documentOf(path: string): Promise<DocumentResult> {
  const pages = await readAllPages(new Uint8Array(readFileSync(path)));
  return buildDocument(pages.map((p) => summarizePage(p)));
}

describe.skipIf(!existsSync(INVOICE))('17768124-00.pdf as a document', () => {
  it('puts the repeated page header in the header once', async () => {
    const doc = await documentOf(INVOICE);
    expect(doc.header[0]).toEqual(['Quotation #: 17768124-00']);
    expect(doc.header).toContainEqual(['Customer #:', '505079']);
    const headerText = doc.header.flat().join(' ');
    expect(headerText.match(/Quotation #/g)).toHaveLength(1);
  });

  it('joins the line items of both pages into one table with one header row', async () => {
    const doc = await documentOf(INVOICE);
    expect(doc.tables).toHaveLength(1);
    const [table] = doc.tables;
    expect(table.pages).toEqual([1, 2]);
    expect(table.rows.filter((r) => r[0] === 'Line #')).toHaveLength(1);
    expect(table.rows.map((r) => r[0]).filter(Boolean)).toEqual(['Line #', '1', '2', '3', '4', '5', '6', '7', '8', '10']);
  });

  it('keeps one Total column on both pages', async () => {
    const [table] = (await documentOf(INVOICE)).tables;
    expect(table.rows.every((r) => r.length === 9)).toBe(true);
    const item7 = table.rows.find((r) => r[0] === '7');
    expect(item7?.[8]).toBe('PF 375.88000');
  });

  it('appends the note carried over from page 1 to item 6', async () => {
    const [table] = (await documentOf(INVOICE)).tables;
    const item6 = table.rows.find((r) => r[0] === '6');
    expect(item6?.[1].endsWith('SUBJECT\nTO ADJUSTMENT AT ANY TIME PRIOR TO ORDER ACCEPTENCE.')).toBe(true);
  });

  it('ends with the totals', async () => {
    const [table] = (await documentOf(INVOICE)).tables;
    expect(table.rows[table.rows.length - 1].filter(Boolean)).toEqual(['Total', '23,045.38']);
  });
});

describe.skipIf(!existsSync(SAMPLE))('sample-tables.pdf as a document', () => {
  it('keeps every separate table apart', async () => {
    const doc = await documentOf(SAMPLE);
    expect(doc.tables).toHaveLength(29);
    expect(doc.tables.every((t) => t.pages.length === 1)).toBe(true);
  });
});
