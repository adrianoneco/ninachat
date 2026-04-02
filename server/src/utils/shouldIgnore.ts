const shouldIgnore = (id?: string): boolean => {
  if (!id) return true;

  return (
    id === 'status@broadcast' ||
    id === '0@c.us' ||
    id.endsWith('@broadcast') ||
    id.includes('@newsletter')
  );
};

export default shouldIgnore;
