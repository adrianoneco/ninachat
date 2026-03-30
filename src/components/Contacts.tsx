import React, { useEffect, useState, useRef } from 'react';
import { Search, Filter, UserPlus, MessageSquare, Loader2, Mail, Phone, Users, Upload, FileSpreadsheet, X, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { Switch } from './ui/switch';
import { api, upsertContact, deleteContact, generateId } from '../services/api';
import { Contact } from '../types';
import { useAuth } from '@/hooks/useAuth';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';

const Contacts: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [previewRows, setPreviewRows] = useState<{ name: string; phone: string; email?: string; status?: string; normalizedPhone?: string; valid?: boolean }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const auth = (() => { try { return useAuth(); } catch { return { user: null }; } })();
  const { user } = auth;
  const companySettings = (() => { try { return useCompanySettings(); } catch { return { isAdmin: false }; } })();
  const { isAdmin } = companySettings;

  useEffect(() => {
    const loadContacts = async () => {
      try {
        const data = await api.fetchContacts();
        // filter contacts associated with private instances the user can't see
        let visible = data;
        try {
          const convs = await api.fetchConversations();
          const instances = await api.fetchInstances();
          const team = await api.fetchTeam();
          const currentMember = user ? team.find((t: any) => t.email === user.email || t.id === user.id) : null;
          const isManager = Boolean(currentMember && (currentMember.role === 'manager' || currentMember.role === 'admin'));

          // find conversations that belong to private instances the current user should not see
          const blockedInstanceIds = new Set(instances.filter((ins: any) => {
            if (!ins.isPrivate) return false;
            if (isAdmin || isManager) return false;
            if (!user) return true;
            if (ins.allowedUserIds && ins.allowedUserIds.includes(user.id)) return false;
            return true;
          }).map((i: any) => i.id));

          const blockedPhones = new Set(convs.filter((c: any) => blockedInstanceIds.has(c.instanceId)).map((c: any) => c.contactPhone));
          visible = data.filter(d => !blockedPhones.has(d.phone));
        } catch (e) {
          // ignore and show all
        }
        setContacts(visible);
      } catch (error) {
        console.error("Erro ao carregar contatos", error);
      } finally {
        setLoading(false);
      }
    };
    loadContacts();
  }, []);

  const filteredContacts = contacts.filter(c => {
    const term = searchTerm.toLowerCase();
    return (
      (c.name?.toLowerCase() || '').includes(term) ||
      (c.phone || '').includes(term) ||
      (c.email?.toLowerCase() || '').includes(term)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'customer': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'lead': return 'bg-primary/10 text-primary border-primary/20';
      case 'churned': return 'bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-300 dark:border-slate-700';
      default: return 'bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-slate-400';
    }
  };

  const handleStartConversation = (contact: Contact) => {
    navigate(`/chat?contact=${encodeURIComponent(contact.phone)}`);
  };

  // Edit contact modal state
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editingExtra, setEditingExtra] = useState<any>({});
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const profileFileRef = useRef<HTMLInputElement | null>(null);
  const companyFileRef = useRef<HTMLInputElement | null>(null);
  const [newTagInput, setNewTagInput] = useState('');
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropFor, setCropFor] = useState<'profile' | 'company' | null>(null);
  const [cropScale, setCropScale] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const lastDragRef = useRef<{ x: number; y: number } | null>(null);
  const cropImgRef = useRef<HTMLImageElement | null>(null);

  // If URL contains ?phone=..., open edit modal for that contact when loaded
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const phone = params.get('phone');
    if (phone && contacts.length > 0) {
      const found = contacts.find(c => c.phone === phone || c.phone === `+${phone.replace(/^\+/, '')}` || (c.phone || '').includes(phone));
      if (found) { setEditingContact(found); setEditingExtra((found as any).extra || {}); }
    }
  }, [contacts]);

  // load tag definitions from backend
  useEffect(() => {
    (async () => {
      const API_BASE = (import.meta as any).env?.VITE_API_BASE || '/api';
      try {
        const res = await fetch(`${API_BASE}/tag_definitions`);
        if (res.ok) { const json = await res.json(); const data = json?.data ?? json; setAvailableTags(data || []); return; }
      } catch {}
      setAvailableTags([]);
    })();
  }, []);

  const handleSaveContact = async (updated: Contact) => {
    try {
      // If images were selected as data URLs, upload them to backend first
      const API_BASE = (import.meta as any).env?.VITE_API_BASE || '/api';
      const uploadIfDataUrl = async (val: any, defaultName: string) => {
        if (!val) return val;
        if (typeof val === 'string' && val.startsWith('data:')) {
          try {
            const ext = (val.match(/^data:(image\/[^;]+);/) || [])[1] || 'image/png';
            const filename = `${defaultName.replace(/\s+/g,'_')}-${Date.now()}.${ext.split('/').pop()}`;
            const res = await fetch(`${API_BASE}/uploads`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename, data: val }),
            });
            const json = await res.json();
            if (json) return json.avatarUrl || json.thumbUrl || json.url || val;
          } catch (e) { console.error('upload failed', e); }
        }
        return val;
      };

      const profileUrl = await uploadIfDataUrl(editingExtra.profilePictureUrl, (updated.name || 'profile'));
      const companyUrl = await uploadIfDataUrl(editingExtra.companyPhotoUrl, (editingExtra.companyName || 'company'));

      const payload = { ...updated, extra: { ...(updated as any).extra, ...(editingExtra || {}), profilePictureUrl: profileUrl, companyPhotoUrl: companyUrl } };
      await upsertContact(payload);
      const list = contacts.map(c => c.id === payload.id ? { ...c, ...payload } : c);
      setContacts(list as Contact[]);
      toast.success('Contato salvo');
      setEditingContact(null);
      setEditingExtra({});
      // remove phone param from url
      const url = new URL(window.location.href);
      url.searchParams.delete('phone');
      window.history.replaceState({}, '', url.toString());
    } catch (err) {
      console.error('Falha ao salvar contato', err);
      toast.error('Falha ao salvar contato');
    }
  };

  const normalizePhoneLocal = (phone: string) => {
    const digits = (phone || '').replace(/\D/g, '');
    if (!digits) return { normalized: '', valid: false };
    if (digits.length === 10 || digits.length === 11) {
      return { normalized: `+55${digits}`, valid: true };
    }
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
      return { normalized: `+${digits}`, valid: true };
    }
    if (digits.length >= 8 && digits.length <= 15) {
      return { normalized: `+${digits}`, valid: true };
    }
    return { normalized: digits, valid: false };
  };

  const parseCsv = (text: string) => {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return [];
    const sep = lines[0].includes(';') ? ';' : ',';
    const header = lines[0].toLowerCase().split(sep).map(h => h.trim().replace(/"/g, ''));
    const nameIdx = header.findIndex(h => ['nome', 'name', 'nome completo'].includes(h));
    const phoneIdx = header.findIndex(h => ['telefone', 'phone', 'celular', 'whatsapp', 'numero', 'número'].includes(h));
    const emailIdx = header.findIndex(h => ['email', 'e-mail'].includes(h));
    const statusIdx = header.findIndex(h => ['status', 'tipo'].includes(h));
    if (phoneIdx === -1) {
      toast.error('Coluna "telefone" não encontrada no CSV');
      return [];
    }
    const rows: { name: string; phone: string; email?: string; status?: string; normalizedPhone?: string; valid?: boolean }[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
      const rawPhone = cols[phoneIdx] || '';
      const normalized = normalizePhoneLocal(rawPhone);
      rows.push({
        name: nameIdx >= 0 ? cols[nameIdx] || '' : '',
        phone: rawPhone,
        email: emailIdx >= 0 ? cols[emailIdx] : undefined,
        status: statusIdx >= 0 ? cols[statusIdx] : undefined,
        normalizedPhone: normalized.normalized,
        valid: normalized.valid,
      });
    }
    return rows;
  };

  const handleCsvChange = (text: string) => {
    setCsvText(text);
    setPreviewRows(parseCsv(text));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      handleCsvChange(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (previewRows.length === 0) return toast.error('Nenhum contato para importar');
    const validRows = previewRows.filter(r => r.valid && r.normalizedPhone);
    const invalidCount = previewRows.length - validRows.length;
    if (validRows.length === 0) return toast.error('Nenhum telefone válido encontrado');
    setImporting(true);
    try {
      const payload = validRows.map(r => ({ name: r.name, phone: r.normalizedPhone || r.phone, email: r.email, status: r.status }));
      const result = await api.importContacts(payload);
      toast.success(`${result.imported} contatos importados${result.skipped ? `, ${result.skipped} ignorados (duplicados)` : ''}${invalidCount ? `, ${invalidCount} inválidos ignorados` : ''}`);
      setIsImportOpen(false);
      setCsvText('');
      setPreviewRows([]);
      const data = await api.fetchContacts();
      setContacts(data);
    } catch (err) {
      console.error(err);
      toast.error('Falha ao importar contatos');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto card-surface">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Contatos</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Gerencie sua base de leads e clientes com inteligência.</p>
        </div>
        <div className="flex items-center gap-3">
        {/* Crop modal */}
        {cropImageSrc && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
            <div className="bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold">Cortar imagem</h4>
                <button onClick={() => { setCropImageSrc(null); setCropFor(null); }} className="text-gray-500 dark:text-slate-400">Fechar</button>
              </div>
              <div className="flex gap-4">
                <div className="w-80 h-80 bg-black/50 rounded overflow-hidden relative">
                  <div
                    className="absolute inset-0 cursor-grab"
                    onPointerDown={(e:any) => { setIsDraggingCrop(true); lastDragRef.current = { x: e.clientX, y: e.clientY }; (e.target as Element).setPointerCapture?.(e.pointerId); }}
                    onPointerMove={(e:any) => {
                      if (!isDraggingCrop || !lastDragRef.current) return;
                      const dx = e.clientX - lastDragRef.current.x;
                      const dy = e.clientY - lastDragRef.current.y;
                      lastDragRef.current = { x: e.clientX, y: e.clientY };
                      setCropOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
                    }}
                    onPointerUp={(e:any) => { setIsDraggingCrop(false); lastDragRef.current = null; (e.target as Element).releasePointerCapture?.(e.pointerId); }}
                  >
                    <img ref={el => (cropImgRef.current = el)} src={cropImageSrc as string} alt="to-crop" style={{ transform: `translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropScale})`, transformOrigin: 'top left', userSelect: 'none' }} className="pointer-events-none absolute top-0 left-0" />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-sm text-gray-500 dark:text-slate-400">Zoom</label>
                  <input type="range" min={0.5} max={3} step={0.01} value={cropScale} onChange={e => setCropScale(Number(e.target.value))} className="w-full" />
                  <div className="flex gap-2 mt-4">
                    <button className="px-4 py-2 rounded bg-primary" onClick={async () => {
                      // perform crop: draw visible 320x320 area
                      const canvas = document.createElement('canvas');
                      const size = 800;
                      canvas.width = size; canvas.height = size;
                      const ctx = canvas.getContext('2d')!;
                      const img = cropImgRef.current!;
                      // draw image taking into account offset and scale
                      ctx.fillStyle = '#000'; ctx.fillRect(0,0,size,size);
                      // compute source drawing using natural size
                      const naturalW = img.naturalWidth; const naturalH = img.naturalHeight;
                      // image is rendered at natural size * scale; offset in px corresponds to that rendered size
                      // we draw image scaled to natural size * scale
                      ctx.drawImage(img, cropOffset.x, cropOffset.y, naturalW * cropScale, naturalH * cropScale);
                      const data = canvas.toDataURL('image/png');
                      // set into editingExtra
                      if (cropFor === 'profile') setEditingExtra((prev: any) => ({ ...prev, profilePictureUrl: data }));
                      if (cropFor === 'company') setEditingExtra((prev: any) => ({ ...prev, companyPhotoUrl: data }));
                      setCropImageSrc(null); setCropFor(null);
                    }}>Cortar e Usar</button>
                    <button className="px-4 py-2 rounded bg-gray-200 dark:bg-slate-800" onClick={() => { setCropImageSrc(null); setCropFor(null); }}>Cancelar</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
          <Button
            variant="outline"
            className="border-primary text-primary hover:bg-primary/10"
            onClick={() => setIsImportOpen(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Importar Contatos
          </Button>
          <Button 
            className="shadow-lg shadow-[0_10px_30px_rgba(30,95,116,0.16)]"
            onClick={() => { setEditingContact({ id: generateId(), name: '', phone: '', email: '', status: 'lead', lastContact: new Date().toISOString() } as any); setEditingExtra({}); }}
            title="Adicionar contato"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Novo Contato
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-8 bg-gray-100/50 dark:bg-slate-900/50 p-2 rounded-xl border border-gray-200 dark:border-slate-800">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-slate-500" />
          <input 
            type="text" 
            placeholder="Buscar por nome, email ou telefone"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-12 py-2.5 rounded-lg theme-input text-sm text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/50 placeholder:text-gray-400 dark:placeholder:text-slate-600 transition-all"
          />
          
        </div>
        <Button 
          variant="outline" 
          className="w-full sm:w-auto theme-input text-gray-500 dark:text-slate-500 cursor-not-allowed opacity-50"
          disabled
          title="Em breve: Filtros avançados"
        >
          <Filter className="w-4 h-4 mr-2" />
          Filtros Avançados
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-100/40 dark:bg-slate-900/40 backdrop-blur-sm shadow-xl overflow-hidden min-h-[400px]">
        {loading ? (
           <div className="flex flex-col items-center justify-center h-80">
             <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
             <span className="text-sm text-gray-500 dark:text-slate-400 animate-pulse">Carregando base de dados...</span>
           </div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 text-gray-500 dark:text-slate-400">
            <Users className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhum contato encontrado</p>
            <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
              {searchTerm ? 'Tente buscar por outro termo' : 'Os contatos aparecerão aqui'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100/80 dark:bg-slate-900/80 text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800 font-medium text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Nome / Telefone</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Canais</th>
                  <th className="px-6 py-4">Última Interação</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/50 dark:divide-slate-800/50">
                {filteredContacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-gray-200/40 dark:bg-slate-800/40 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 dark:from-slate-700 dark:to-slate-800 border border-gray-300 dark:border-slate-700 flex items-center justify-center text-sm font-bold text-primary shadow-inner">
                          {(contact.name || contact.phone || '?').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <div className="font-semibold text-gray-700 dark:text-slate-200 group-hover:text-primary transition-colors">
                              {contact.name || 'Sem nome'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-slate-500">{contact.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${getStatusColor(contact.status)}`}>
                        {contact.status === 'customer' ? 'Cliente Ativo' : contact.status === 'lead' ? 'Lead Qualificado' : 'Churned'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {contact.email && (
                          <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400 text-xs">
                              <Mail className="w-3.5 h-3.5" />
                              {contact.email}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400 text-xs">
                            <Phone className="w-3.5 h-3.5" />
                            {contact.phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-gray-500 dark:text-slate-400">{new Date(contact.lastContact).toLocaleDateString('pt-BR')}</span>
                       <div className="text-[10px] text-gray-400 dark:text-slate-600">via WhatsApp</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <Button 
                          size="sm" 
                          variant="primary" 
                          className="h-8 w-8 p-0 rounded-lg shadow-none" 
                          title="Iniciar Conversa"
                          onClick={() => handleStartConversation(contact)}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 rounded-lg text-gray-500 dark:text-slate-400 hover:text-primary"
                          title="Editar contato"
                          onClick={() => { setEditingContact(contact); setEditingExtra((contact as any).extra || {}); }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          className="h-8 w-8 p-0 rounded-lg text-red-400 hover:text-red-300"
                          title="Excluir contato"
                          onClick={async () => {
                            if (!confirm('Deseja realmente excluir este contato?')) return;
                            try {
                              await deleteContact(contact.id);
                              setContacts(prev => prev.filter(c => c.id !== contact.id));
                              toast.success('Contato excluído');
                            } catch (err) {
                              console.error('Falha ao excluir contato', err);
                              toast.error('Falha ao excluir contato');
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        {/* removed 'more options' placeholder */}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        <ImportContactsModal
        open={isImportOpen}
        onClose={() => { setIsImportOpen(false); setCsvText(''); setPreviewRows([]); }}
        csvText={csvText}
        onCsvChange={handleCsvChange}
        previewRows={previewRows}
        importing={importing}
        onImport={handleImport}
        fileInputRef={fileInputRef}
        onFileUpload={handleFileUpload}
      />

        {editingContact && (
          <Sheet open={!!editingContact} onOpenChange={(open) => { if (!open) { setEditingContact(null); setEditingExtra({}); } }}>
            <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
              <SheetHeader className="p-4 border-b border-gray-200 dark:border-slate-800">
                <SheetTitle className="text-lg font-bold">Editar Contato</SheetTitle>
              </SheetHeader>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-slate-400">Nome</label>
                    <input className="w-full mt-1 p-2 theme-input" value={editingContact.name || ''} onChange={e => setEditingContact({ ...editingContact, name: e.target.value } as any)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-slate-400">Empresa</label>
                    <input className="w-full mt-1 p-2 theme-input" value={editingExtra.companyName || ''} onChange={e => setEditingExtra({ ...editingExtra, companyName: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-slate-400">Telefone</label>
                    <input className="w-full mt-1 p-2 theme-input" value={editingContact.phone || ''} onChange={e => setEditingContact({ ...editingContact, phone: e.target.value } as any)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-slate-400">Email</label>
                    <input className="w-full mt-1 p-2 theme-input" value={editingContact.email || ''} onChange={e => setEditingContact({ ...editingContact, email: e.target.value } as any)} />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 dark:text-slate-400">Código do cliente</label>
                  <input className="w-full mt-1 p-2 theme-input" value={editingExtra.clientCode || ''} onChange={e => setEditingExtra({ ...editingExtra, clientCode: e.target.value })} placeholder="Opcional" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-slate-400">Foto do Contato (URL ou upload)</label>
                    {editingExtra.profilePictureUrl ? (
                      <img src={editingExtra.profilePictureUrl as string} alt="profile" className="w-16 h-16 rounded-full mb-2 object-cover border border-gray-200 dark:border-slate-800" />
                    ) : null}
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => profileFileRef.current?.click()} className="px-3 py-1 rounded bg-gray-200 dark:bg-slate-800 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-300 dark:bg-slate-700">Escolher arquivo</button>
                      <button type="button" onClick={() => setEditingExtra((prev: any) => ({ ...prev, profilePictureUrl: '' }))} className="px-2 py-1 rounded bg-gray-100 dark:bg-slate-900 text-sm text-gray-500 dark:text-slate-400">Remover</button>
                    </div>
                    <input ref={el => (profileFileRef.current = el)} type="file" accept="image/*" className="hidden" onChange={e => {
                      const f = e.target.files?.[0]; if (!f) return;
                      const reader = new FileReader(); reader.onload = (ev) => {
                        const data = ev.target?.result as string;
                        setCropImageSrc(data);
                        setCropFor('profile');
                        setCropScale(1);
                        setCropOffset({ x: 0, y: 0 });
                      };
                      reader.readAsDataURL(f);
                      e.currentTarget.value = '';
                    }} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-slate-400">Foto da Empresa (URL ou upload)</label>
                    {editingExtra.companyPhotoUrl ? (
                      <img src={editingExtra.companyPhotoUrl as string} alt="company" className="w-20 h-12 rounded-md mb-2 object-cover border border-gray-200 dark:border-slate-800" />
                    ) : null}
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => companyFileRef.current?.click()} className="px-3 py-1 rounded bg-gray-200 dark:bg-slate-800 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-300 dark:bg-slate-700">Escolher arquivo</button>
                      <button type="button" onClick={() => setEditingExtra((prev: any) => ({ ...prev, companyPhotoUrl: '' }))} className="px-2 py-1 rounded bg-gray-100 dark:bg-slate-900 text-sm text-gray-500 dark:text-slate-400">Remover</button>
                    </div>
                    <input ref={el => (companyFileRef.current = el)} type="file" accept="image/*" className="hidden" onChange={e => {
                      const f = e.target.files?.[0]; if (!f) return;
                      const reader = new FileReader(); reader.onload = (ev) => {
                        const data = ev.target?.result as string;
                        setCropImageSrc(data);
                        setCropFor('company');
                        setCropScale(1);
                        setCropOffset({ x: 0, y: 0 });
                      };
                      reader.readAsDataURL(f);
                      e.currentTarget.value = '';
                    }} />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 dark:text-slate-400">Tags</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(editingExtra.tags || []).map((t: string, idx: number) => (
                      <div key={idx} className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-gray-200 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-200">
                        <span>{t}</span>
                        <button onClick={() => setEditingExtra((prev:any) => ({ ...prev, tags: (prev.tags || []).filter((x:string)=>x !== t) }))} className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:text-white">×</button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <input placeholder="Adicionar tag e pressione Enter" className="w-full mt-1 p-2 theme-input" value={newTagInput} onChange={e => setNewTagInput(e.target.value)} onKeyDown={e => {
                      const val = newTagInput.trim();
                      if (e.key === 'Enter' && val) {
                        e.preventDefault();
                        setEditingExtra((prev:any) => ({ ...prev, tags: Array.from(new Set([...(prev.tags||[]), val])) }));
                        setNewTagInput('');
                      }
                      if (e.key === ',') {
                        e.preventDefault();
                        const parts = newTagInput.split(',').map(s=>s.trim()).filter(Boolean);
                        if (parts.length) {
                          setEditingExtra((prev:any) => ({ ...prev, tags: Array.from(new Set([...(prev.tags||[]), ...parts])) }));
                          setNewTagInput('');
                        }
                      }
                    }} />
                    <div className="text-xs text-gray-500 dark:text-slate-500 mt-2 flex gap-2 flex-wrap">
                      {(availableTags || []).slice(0,6).map((t,i) => (
                        <button key={i} type="button" onClick={() => setEditingExtra((prev:any) => ({ ...prev, tags: Array.from(new Set([...(prev.tags||[]), t.key || t || ''])) }))} className="px-2 py-1 rounded bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-slate-300 text-xs">{t.label || t.key || t}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label htmlFor="isBusiness" className="text-xs text-gray-500 dark:text-slate-400">É empresa / negócio</label>
                  <Switch id="isBusiness" checked={Boolean(editingExtra.isBusiness)} onCheckedChange={(val) => setEditingExtra({ ...editingExtra, isBusiness: Boolean(val) })} />
                </div>

                <div>
                  <label className="text-xs text-gray-500 dark:text-slate-400">Notas</label>
                  <textarea className="w-full mt-1 p-2 theme-input" rows={3} value={editingExtra.notes || ''} onChange={e => setEditingExtra({ ...editingExtra, notes: e.target.value })} />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" className="px-4 py-2" onClick={() => { setEditingContact(null); setEditingExtra({}); }}>Cancelar</Button>
                  <Button className="px-4 py-2 bg-primary hover:bg-primary/90" onClick={() => handleSaveContact(editingContact as Contact)}>Salvar</Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        )}
    </div>
  );
};

/* Import Contacts Sidebar */
const ImportContactsModal: React.FC<{
  open: boolean;
  onClose: () => void;
  csvText: string;
  onCsvChange: (t: string) => void;
  previewRows: { name: string; phone: string; email?: string; status?: string }[];
  importing: boolean;
  onImport: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ open, onClose, csvText, onCsvChange, previewRows, importing, onImport, fileInputRef, onFileUpload }) => {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-6 border-b border-gray-200 dark:border-slate-800">
          <SheetTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-cyan-400" /> Importar Contatos</SheetTitle>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Faça upload de um arquivo CSV ou cole os dados abaixo.</p>
        </SheetHeader>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {/* Upload area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-cyan-600 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors group"
          >
            <Upload className="w-8 h-8 text-gray-500 dark:text-slate-500 group-hover:text-cyan-400 mb-2 transition-colors" />
            <p className="text-sm text-gray-500 dark:text-slate-400 group-hover:text-gray-600 dark:text-slate-300">Clique para selecionar um arquivo <span className="text-cyan-400 font-medium">.csv</span></p>
            <p className="text-xs text-gray-400 dark:text-slate-600 mt-1">ou arraste e solte aqui</p>
            <input ref={fileInputRef as any} type="file" accept=".csv,.txt" className="hidden" onChange={onFileUpload} />
          </div>

          {/* Or paste */}
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 mb-1 block">Ou cole o conteúdo CSV:</label>
            <textarea
              rows={5}
              value={csvText}
              onChange={e => onCsvChange(e.target.value)}
              placeholder={'nome;telefone;email;status\nMaria Silva;5511999990001;maria@email.com;lead\nJoão Santos;5511999990002;joao@email.com;customer'}
              className="w-full theme-input px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:text-slate-600 focus:ring-2 focus:ring-ring/50 outline-none font-mono"
            />
          </div>

          {/* Format hint */}
          <div className="text-xs text-gray-500 dark:text-slate-500 card-surface p-3 rounded-lg border">
            <strong className="text-gray-500 dark:text-slate-400">Formato esperado:</strong> CSV com colunas <code className="text-cyan-400">nome</code>, <code className="text-cyan-400">telefone</code> (obrigatório), <code className="text-cyan-400">email</code>, <code className="text-cyan-400">status</code> (lead/customer/churned). Separador: <code className="text-cyan-400">;</code> ou <code className="text-cyan-400">,</code>
          </div>

          {/* Preview */}
          {previewRows.length > 0 && (
            <div>
              <p className="text-sm text-gray-600 dark:text-slate-300 mb-2 font-medium">Pré-visualização ({previewRows.length} contatos):</p>
              <div className="overflow-x-auto max-h-48 rounded-lg border border-gray-200 dark:border-slate-800">
                <table className="w-full text-xs">
                  <thead className="bg-gray-200/60 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Nome</th>
                      <th className="px-3 py-2 text-left">Telefone</th>
                      <th className="px-3 py-2 text-left">Email</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/50 dark:divide-slate-800/50">
                    {previewRows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="text-gray-600 dark:text-slate-300 hover:bg-gray-200/30 dark:hover:bg-slate-800/30">
                        <td className="px-3 py-1.5">{r.name || <span className="text-gray-400 dark:text-slate-600 italic">Sem nome</span>}</td>
                        <td className="px-3 py-1.5 font-mono">{r.phone}</td>
                        <td className="px-3 py-1.5">{r.email || '—'}</td>
                        <td className="px-3 py-1.5">{r.status || 'lead'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewRows.length > 50 && <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">Mostrando 50 de {previewRows.length} contatos...</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-slate-800">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-slate-800 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-300 dark:bg-slate-700 transition-colors">
            Cancelar
          </button>
          <button
            onClick={onImport}
            disabled={importing || previewRows.length === 0}
            className="px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {importing ? 'Importando...' : `Importar ${previewRows.length} contatos`}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default Contacts;
