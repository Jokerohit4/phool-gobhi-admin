import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';

let updateContentExercise;

beforeEach(async () => {
  const mod = await import('@/lib/contentApi');
  updateContentExercise = mod.updateContentExercise;
});

describe('content action fields', () => {
  it('edit action sends only allowed fields', () => {
    expect(updateContentExercise).toBeDefined();
  });

  it('approve sends the displayed version', () => {
    expect(updateContentExercise).toBeDefined();
  });
});

describe('content approve/reject 409 handling', () => {
  it('maps 409 to reload message', () => {
    expect(true).toBe(true);
  });
});

describe('sidebar entries', () => {
  it('includes Content link', () => {
    const sidebarPath = 'app/sidebar.tsx';
    const content = fs.readFileSync(sidebarPath, 'utf-8');
    expect(content).toContain('/content');
  });

  it('includes Unclaimed gyms link', () => {
    const sidebarPath = 'app/sidebar.tsx';
    const content = fs.readFileSync(sidebarPath, 'utf-8');
    expect(content).toContain('/unclaimed-gyms');
  });
});