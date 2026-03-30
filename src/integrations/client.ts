const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE) || '/api';

// Minimal HTTP-backed client with a supabase-like `from(table)` helper
const supabase = {
  from(table: string) {
    const ctx: any = { table, where: null, limitN: null };

    const execSelect = async () => {
      try {
        const res = await fetch(`${API_BASE}/${table}`);
        if (res.ok) {
          const json = await res.json();
          let results = json?.data ?? json ?? [];
          if (!Array.isArray(results)) results = results ? [results] : [];
          if (ctx.where) {
            results = results.filter((r: any) => Object.keys(ctx.where).every((k) => r[k] === ctx.where[k]));
          }
          if (ctx.limitN != null) results = results.slice(0, ctx.limitN);
          return { data: ctx.limitN === 1 ? results[0] ?? null : results, error: null };
        }
      } catch {}
      return { data: ctx.limitN === 1 ? null : [], error: null };
    };

    const chain: any = {
      select(_cols?: string) { return chain; },
      limit(n: number) { ctx.limitN = n; return chain; },
      single() { return execSelect(); },
      eq(col: string, val: any) { ctx.where = ctx.where || {}; ctx.where[col] = val; return chain; },
      async update(obj: any) {
        try {
          const res = await fetch(`${API_BASE}/${table}`);
          if (res.ok) {
            const json = await res.json();
            let rows: any[] = json?.data ?? json ?? [];
            let updated: any = null;
            rows = rows.map((row: any) => {
              let match = true;
              if (ctx.where) {
                for (const k of Object.keys(ctx.where)) {
                  if (row[k] !== ctx.where[k]) { match = false; break; }
                }
              }
              if (match) { const u = { ...row, ...obj }; updated = u; return u; }
              return row;
            });
            await fetch(`${API_BASE}/${table}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rows) });
            return { data: updated, error: null };
          }
        } catch {}
        return { data: null, error: null };
      },
      insert(obj: any) {
        const id = obj.id ?? (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
        const record = { id, ...obj };
        const doInsert = async () => {
          try {
            const res = await fetch(`${API_BASE}/${table}`);
            let rows: any[] = [];
            if (res.ok) { const json = await res.json(); rows = json?.data ?? json ?? []; }
            if (!Array.isArray(rows)) rows = [];
            rows.push(record);
            await fetch(`${API_BASE}/${table}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rows) });
          } catch {}
        };
        doInsert();
        return {
          select: (_cols?: string) => ({ single: async () => ({ data: record, error: null }) })
        };
      }
    };

    return chain;
  },

  auth: {
    onAuthStateChange(cb: (event: string, session: any) => void) {
      setTimeout(() => cb('INITIAL_SESSION', null), 0);
      return { data: { subscription: { unsubscribe() {} } } };
    },
    async getSession() { return { data: { session: null } }; },
    async signUp() { return { data: null, error: new Error('signup unsupported') }; },
    async signInWithPassword() { return { error: new Error('signin unsupported') }; },
    async signOut() { return { error: null }; }
  },

  functions: { async invoke(_name: string) { return { data: null }; } }
};

export { supabase };
