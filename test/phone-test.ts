function formatBR(phone: string): string | null {
  // remove tudo que não for número
  const clean = phone.replace(/\D/g, '');

  // precisa começar com 55
  if (!clean.startsWith('55')) return null;

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

  return null;
}
console.log('Celular:', formatBR('5541995927699'));
// +55 (41) 9 95927699

console.log('Telefone:', formatBR('554195927699'));
// +55 (41) 9592-7699