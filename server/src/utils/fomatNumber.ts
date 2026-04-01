export function formatBR(phone: string): string {
  // remove tudo que não for número
  const clean = phone.replace(/\D/g, '');

  // precisa começar com 55
  if (!clean.startsWith('55')) return phone;

  const number = clean.slice(2); // remove DDI

  // DDD
  const ddd = number.slice(0, 2);
  const rest = number.slice(2);

  // celular (9 dígitos)
  if (rest.length === 9) {
    return `+55 (${ddd}) ${rest[0]} ${rest.slice(1)}`;
  }

  // fixo (8 dígitos)
  if (rest.length === 8) {
    return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }

  return phone;
}

