export function canViewInstance(instance: any, user: any, team: any[], isAdmin: boolean) {
  if (!instance) return false;
  if (isAdmin) return true;
  const currentMember = user ? team.find((t: any) => t.email === user.email || t.id === user.id) : null;
  const isManager = Boolean(currentMember && (currentMember.role === 'manager' || currentMember.role === 'admin'));
  if (isManager) return true;
  if (!instance.isPrivate) return true;
  if (!user) return false;
  if (instance.allowedUserIds && instance.allowedUserIds.includes(user.id)) return true;
  return false;
}

export function canViewConversation(conv: any, user: any, team: any[], isAdmin: boolean) {
  if (!conv) return false;
  if (isAdmin) return true;
  const currentMember = user ? team.find((t: any) => t.email === user.email || t.id === user.id) : null;
  const isManager = Boolean(currentMember && (currentMember.role === 'manager' || currentMember.role === 'admin'));
  if (isManager) return true;
  if (!conv.assignedUserId) return true;
  if (!user) return false;
  return conv.assignedUserId === user.id;
}
