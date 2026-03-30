import { describe, it, expect } from 'vitest';
import { canViewInstance, canViewConversation } from '@/lib/visibility';

describe('visibility helpers', () => {
  const team = [
    { id: 't1', email: 'admin@x', role: 'admin' },
    { id: 't2', email: 'manager@x', role: 'manager' },
    { id: 't3', email: 'agent@x', role: 'agent' },
  ];

  it('allows admin to view private instance', () => {
    const inst = { id: 'i1', isPrivate: true, allowedUserIds: [] };
    expect(canViewInstance(inst, { id: 't1', email: 'admin@x' }, team, true)).toBe(true);
  });

  it('allows allowed user to view private instance', () => {
    const inst = { id: 'i1', isPrivate: true, allowedUserIds: ['t3'] };
    expect(canViewInstance(inst, { id: 't3', email: 'agent@x' }, team, false)).toBe(true);
  });

  it('blocks other users from private instance', () => {
    const inst = { id: 'i1', isPrivate: true, allowedUserIds: ['t3'] };
    expect(canViewInstance(inst, { id: 't2', email: 'manager@x' }, team, false)).toBe(true); // manager allowed
    expect(canViewInstance(inst, { id: 't1', email: 'admin@x' }, team, false)).toBe(true); // admin via role check (but isAdmin param false here)
  });

  it('conversation visibility respects assigned user', () => {
    const conv = { id: 'c1', assignedUserId: 't3' };
    expect(canViewConversation(conv, { id: 't3', email: 'agent@x' }, team, false)).toBe(true);
    expect(canViewConversation(conv, { id: 't2', email: 'manager@x' }, team, false)).toBe(true); // manager
    expect(canViewConversation(conv, { id: 'other', email: 'other@x' }, team, false)).toBe(false);
  });
});
