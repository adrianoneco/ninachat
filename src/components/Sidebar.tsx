import React, { useState, useEffect } from 'react';
import { LayoutDashboard, MessageSquare, Users, Settings as SettingsIcon, Calendar, Kanban, Eye } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from '@/components/ui/sidebar';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import viaIcon from '@/assets/icon-via.png';

const menuItemsBase = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'pipeline', label: 'Pipeline', icon: Kanban },
  { id: 'chat', label: 'Chat Ao Vivo', icon: MessageSquare },
  { id: 'contacts', label: 'Contatos', icon: Users },
  { id: 'scheduling', label: 'Agendamentos', icon: Calendar },
  { id: 'settings', label: 'Configurações', icon: SettingsIcon },
];

const monitorItem = { id: 'monitor', label: 'Monitoramento', icon: Eye };

const Logo = ({ companyName }: { companyName: string }) => {
  return (
    <Link to="/dashboard" className="flex items-center space-x-3 py-1">
      <div className="relative w-10 h-10 flex items-center justify-center flex-shrink-0">
        <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
        <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 p-1.5">
          <img src={viaIcon} alt="Logo" className="w-full h-full object-contain" />
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col overflow-hidden"
      >
        <span className="font-bold text-lg tracking-tight text-foreground whitespace-nowrap">{companyName || 'Minha Empresa'}</span>
        <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Workspace</span>
      </motion.div>
    </Link>
  );
};

const LogoIcon = () => {
  return (
    <Link to="/dashboard" className="flex items-center py-1">
      <div className="relative w-10 h-10 flex items-center justify-center flex-shrink-0">
        <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
        <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 p-1.5">
          <img src={viaIcon} alt="Logo" className="w-full h-full object-contain" />
        </div>
      </div>
    </Link>
  );
};

const SidebarContent = () => {
  const { companyName, isAdmin } = useCompanySettings();
  const location = useLocation();
  const currentPath = location.pathname.substring(1) || 'dashboard';
  const { open } = useSidebar();
  const [menuItems, setMenuItems] = useState(menuItemsBase);

  const auth = useAuth();
  // determine current user and whether they are allowed to see Monitor
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        let allowed = false;
        const user = auth?.user ?? null;
        // allow if company-level admin flag is set (mock)
        if (isAdmin) allowed = true;
        if (!allowed && user) {
          const team = await api.fetchTeam();
          const member = team.find((t: any) => t.email === user.email || t.id === user.id);
          if (member && (member.role === 'admin' || member.role === 'manager')) allowed = true;
        }
        // We no longer surface Monitoramento in the main sidebar menu.
        // Monitoramento is available under Configurações → Relatórios.
        if (mounted) setMenuItems(menuItemsBase);
      } catch (err) {
        console.error('sidebar load error', err);
      }
    };
    load();
    return () => { mounted = false; };
  }, [auth]);

  const links = menuItems.map(item => ({
    label: item.label,
    href: `/${item.id}`,
    icon: <item.icon className="h-5 w-5" />,
  }));

  return (
    <>
      <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mb-6">
          {open ? <Logo companyName={companyName} /> : <LogoIcon />}
        </div>
        
        <nav className="flex flex-col gap-1.5">
          {links.map((link, idx) => (
            <SidebarLink
              key={idx}
              link={link}
              isActive={currentPath.startsWith(link.href.slice(1))}
            />
          ))}
        </nav>
      </div>

      {/* VIA Logo - Footer */}
      

      {/* User Footer */}
      <div className="border-t border-border/50 pt-4">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/50 transition-colors cursor-pointer group">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary/20 to-secondary flex items-center justify-center text-xs font-bold text-primary border border-border ring-2 ring-transparent group-hover:ring-primary/20 transition-all flex-shrink-0">
            AD
          </div>
          <motion.div
            animate={{
              display: open ? "block" : "none",
              opacity: open ? 1 : 0,
            }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-hidden"
          >
            <p className="text-sm font-medium text-foreground group-hover:text-foreground whitespace-nowrap">Admin</p>
            <p className="text-xs text-muted-foreground truncate">admin@mock.local</p>
          </motion.div>
        </div>
      </div>
    </>
  );
};

const AppSidebar: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <Sidebar open={open} setOpen={setOpen}>
      <SidebarBody className="justify-between gap-10 bg-card/50 backdrop-blur-xl border-r border-border/50">
        <SidebarContent />
      </SidebarBody>
    </Sidebar>
  );
};

export default AppSidebar;
