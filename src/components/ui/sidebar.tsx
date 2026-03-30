"use client";

import { cn } from "@/lib/utils";
import { Link, LinkProps, useLocation } from "react-router-dom";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, ChevronLeft, LayoutDashboard, MessageSquare, Users, Settings, Calendar, Kanban } from "lucide-react";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  return (
    <>
      <DesktopSidebar className={className}>{children}</DesktopSidebar>
      <MobileSidebar className={className}>{children}</MobileSidebar>
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <div className="relative h-full flex-shrink-0">
      <motion.div
        className={cn(
          "h-full px-4 py-4 hidden md:flex md:flex-col w-[260px]",
          className
        )}
        animate={{
          width: animate ? (open ? "260px" : "76px") : "260px",
        }}
        transition={{
          duration: 0.3,
          ease: "easeInOut",
        }}
        {...props}
      >
        {children}
      </motion.div>
      
      {/* Toggle Button - outside motion.div to avoid type issues */}
      <button
        onClick={() => setOpen(!open)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 
                   bg-gray-200 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-full 
                   hidden md:flex items-center justify-center
                   hover:bg-gray-300 dark:bg-slate-700 hover:border-cyan-500/50 
                   transition-all shadow-lg z-50 group"
      >
        <ChevronLeft 
          className={cn(
            "w-4 h-4 text-gray-500 dark:text-slate-400 group-hover:text-cyan-400 transition-all duration-300",
            !open && "rotate-180"
          )} 
        />
      </button>
    </div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();
  const location = useLocation();
  const pathname = location.pathname || '/';
  return (
    <>
      <div
        className={cn(
          "h-14 px-4 py-4 flex flex-row md:hidden items-center justify-between bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl w-full border-b border-gray-200/50 dark:border-slate-800/50"
        )}
        {...props}
      >
        <div className="flex justify-end z-20 w-full">
          <Menu
            className="text-gray-700 dark:text-slate-200 cursor-pointer hover:text-cyan-400 transition-colors"
            onClick={() => setOpen(!open)}
          />
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: "easeInOut",
              }}
              className={cn(
                "fixed h-full w-full inset-0 bg-white dark:bg-slate-950 p-10 z-[100] flex flex-col justify-between",
                className
              )}
            >
              <div
                className="absolute right-10 top-10 z-50 text-gray-700 dark:text-slate-200 cursor-pointer hover:text-cyan-400 transition-colors"
                onClick={() => setOpen(!open)}
              >
                <X />
              </div>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Bottom navigation for mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-950/95 border-t border-gray-200/50 dark:border-slate-800/50 p-2" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-4xl mx-auto flex items-center justify-around">
          <Link to="/dashboard" aria-label="Dashboard" className={cn("flex flex-col items-center gap-1 text-[11px] px-2 py-1 rounded-md", pathname.startsWith('/dashboard') ? 'text-cyan-400' : 'text-gray-500 dark:text-slate-400') }>
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Início</span>
          </Link>
          <Link to="/pipeline" aria-label="Pipeline" className={cn("flex flex-col items-center gap-1 text-[11px] px-2 py-1 rounded-md", pathname.startsWith('/pipeline') ? 'text-cyan-400' : 'text-gray-500 dark:text-slate-400') }>
            <Kanban className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Pipeline</span>
          </Link>
          <Link to="/chat" aria-label="Chat" className={cn("flex flex-col items-center gap-1 text-[11px] px-2 py-1 rounded-md", pathname.startsWith('/chat') ? 'text-cyan-400' : 'text-gray-500 dark:text-slate-400') }>
            <MessageSquare className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Chat</span>
          </Link>
          <Link to="/contacts" aria-label="Contatos" className={cn("flex flex-col items-center gap-1 text-[11px] px-2 py-1 rounded-md", pathname.startsWith('/contacts') ? 'text-cyan-400' : 'text-gray-500 dark:text-slate-400') }>
            <Users className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Contatos</span>
          </Link>
          <Link to="/scheduling" aria-label="Agendamentos" className={cn("flex flex-col items-center gap-1 text-[11px] px-2 py-1 rounded-md", pathname.startsWith('/scheduling') ? 'text-cyan-400' : 'text-gray-500 dark:text-slate-400') }>
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Agenda</span>
          </Link>
          <Link to="/settings" aria-label="Configurações" className={cn("flex flex-col items-center gap-1 text-[11px] px-2 py-1 rounded-md", pathname.startsWith('/settings') ? 'text-cyan-400' : 'text-gray-500 dark:text-slate-400') }>
            <Settings className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Ajustes</span>
          </Link>
        </div>
      </nav>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  isActive,
  onClick,
  ...props
}: {
  link: Links;
  className?: string;
  isActive?: boolean;
  onClick?: () => void;
  props?: Omit<LinkProps, 'to'>;
}) => {
  const { open, animate } = useSidebar();
  return (
    <Link
      to={link.href}
      onClick={onClick}
      className={cn(
        "flex items-center justify-start gap-3 group/sidebar py-3 px-3 rounded-xl transition-all duration-200 relative overflow-hidden",
        isActive
          ? "bg-gray-200/80 dark:bg-slate-800/80 text-cyan-400 shadow-lg shadow-gray-300/20 dark:shadow-black/20 ring-1 ring-slate-700/50"
          : "text-gray-500 dark:text-slate-400 hover:bg-gray-200/40 dark:bg-slate-800/40 hover:text-gray-700 dark:text-slate-200",
        className
      )}
      {...props}
    >
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500 rounded-l-md shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
      )}
      <span className={cn(
        "flex-shrink-0 transition-colors",
        isActive ? "text-cyan-400" : "text-gray-500 dark:text-slate-500 group-hover/sidebar:text-gray-600 dark:text-slate-300"
      )}>
        {link.icon}
      </span>
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        transition={{
          duration: 0.2,
          ease: "easeInOut",
        }}
        className={cn(
          "text-sm font-medium group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre",
          isActive && "text-cyan-50"
        )}
      >
        {link.label}
      </motion.span>
    </Link>
  );
};
