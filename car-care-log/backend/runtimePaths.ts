import fs from 'node:fs';

const ASAR_SEGMENT = /(^|[\\/])app\.asar([\\/]|$)/;

export function unpackedVariantForPackagedPath(candidatePath: string): string {
  return candidatePath.replace(ASAR_SEGMENT, '$1app.asar.unpacked$2');
}

export function preferUnpackedPath(candidatePath: string, exists: (filePath: string) => boolean = fs.existsSync): string {
  const unpackedPath = unpackedVariantForPackagedPath(candidatePath);
  if (unpackedPath === candidatePath) return candidatePath;
  return exists(unpackedPath) ? unpackedPath : candidatePath;
}
