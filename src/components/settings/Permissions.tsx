import React, { useEffect, useState } from 'react';
import { Button } from '../Button';
import { useAuth } from '@/hooks/useAuth';

type Permission = { id: string; key: string; description?: string };
type Role = { id: string; name: string; description?: string; permissions?: Permission[] };

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const PermissionsScreen: React.FC = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch(`${API_BASE}/roles`);
      const rolesJson = await r.json();
      setRoles(rolesJson || []);
      const p = await fetch(`${API_BASE}/roles/permissions`);
      const permsJson = await p.json();
      setPerms(permsJson || []);
      setSelectedRole((rolesJson || [])[0] || null);
    })();
  }, []);

  useEffect(() => { if (selectedRole) setDirtyKeys(new Set((selectedRole.permissions || []).map(p => p.key))); }, [selectedRole]);

  const toggle = (key: string) => {
    const next = new Set(dirtyKeys);
    if (next.has(key)) next.delete(key); else next.add(key);
    setDirtyKeys(next);
  };

  const save = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/roles/${selectedRole.id}/permissions`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
        body: JSON.stringify({ keys: Array.from(dirtyKeys) }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setRoles(rs => rs.map(r => r.id === updated.id ? updated : r));
      setSelectedRole(updated);
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-4 gap-6">
      <div className="col-span-1 bg-card border border-border rounded-xl p-4">
        <h3 className="font-semibold mb-2">Roles</h3>
        <ul className="space-y-2">
          {roles.map(r => (
            <li key={r.id}>
              <button onClick={() => setSelectedRole(r)} className={`w-full text-left p-2 rounded ${selectedRole?.id === r.id ? 'bg-cyan-500/10 text-cyan-400' : 'hover:bg-gray-100'}`}>
                <div className="text-sm font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.description}</div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="col-span-3 bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Permissões</h3>
          <div>
            <Button variant="ghost" onClick={() => { if (selectedRole) setDirtyKeys(new Set((selectedRole.permissions || []).map((p:any)=>p.key))) }}>Reverter</Button>
            <Button variant="primary" onClick={save} className="ml-2" disabled={!selectedRole || saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>

        {!selectedRole && <div>Selecione um papel à esquerda</div>}

        {selectedRole && (
          <div className="grid grid-cols-2 gap-4">
            {perms.map(p => (
              <label key={p.id} className="flex items-center gap-3 p-3 border rounded">
                <input type="checkbox" checked={dirtyKeys.has(p.key)} onChange={() => toggle(p.key)} />
                <div>
                  <div className="font-medium">{p.key}</div>
                  <div className="text-sm text-muted-foreground">{p.description}</div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PermissionsScreen;
