import { describe, it, expect } from 'vitest';
import { calculateScore } from '../scoring-engine';
import type { FieldDefinition } from '../field-schema';
import type { FieldValue } from '../field-value';

const makeField = (key: string, weight: number): FieldDefinition => ({
  key,
  label: key,
  category: 'basic_info',
  type: 'text',
  weight,
  extractTier: 'A',
  required: true,
});

const makeFV = (value: unknown): FieldValue => ({
  value,
  source: 'manual_input',
  confidence: 'high',
  updatedBy: 'test',
  updatedAt: new Date().toISOString(),
});

describe('calculateScore', () => {
  it('returns 0 for empty field values', () => {
    const schema = [makeField('a', 5), makeField('b', 5)];
    const result = calculateScore(schema, {});
    expect(result.score).toBe(0);
    expect(result.missingFields).toEqual(['a', 'b']);
  });

  it('returns 100 for all fields filled', () => {
    const schema = [makeField('a', 5), makeField('b', 5)];
    const values: Record<string, FieldValue> = {
      a: makeFV('hello'),
      b: makeFV('world'),
    };
    const result = calculateScore(schema, values);
    expect(result.score).toBe(100);
    expect(result.missingFields).toEqual([]);
  });

  it('calculates weighted score correctly', () => {
    const schema = [makeField('a', 8), makeField('b', 2)];
    const values: Record<string, FieldValue> = { a: makeFV('filled') };
    const result = calculateScore(schema, values);
    // 8 / 10 * 100 = 80
    expect(result.score).toBe(80);
    expect(result.filledWeight).toBe(8);
    expect(result.totalWeight).toBe(10);
  });

  it('returns 0 for empty schema', () => {
    const result = calculateScore([], {});
    expect(result.score).toBe(0);
  });

  it('treats empty string as missing', () => {
    const schema = [makeField('a', 10)];
    const values: Record<string, FieldValue> = { a: makeFV('') };
    const result = calculateScore(schema, values);
    expect(result.score).toBe(0);
    expect(result.missingFields).toEqual(['a']);
  });

  it('treats empty array as missing', () => {
    const schema = [makeField('a', 10)];
    const values: Record<string, FieldValue> = { a: makeFV([]) };
    const result = calculateScore(schema, values);
    expect(result.score).toBe(0);
  });

  it('rounds correctly at boundary (79.5 → 80)', () => {
    // filledWeight=159, totalWeight=200 → 79.5 → rounds to 80
    const schema = [makeField('a', 159), makeField('b', 41)];
    const values: Record<string, FieldValue> = { a: makeFV('yes') };
    const result = calculateScore(schema, values);
    expect(result.score).toBe(80);
  });
});
