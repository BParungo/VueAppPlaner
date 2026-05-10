import * as Y from 'yjs';
import { supabase } from '@/lib/supabase/client';

const BUCKET = 'boards';

function objectPath(boardId: string) {
  return `${boardId}/current.ydoc`;
}

export async function downloadSnapshot(
  boardId: string,
): Promise<Uint8Array | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(objectPath(boardId));
  if (error) {
    if (
      'statusCode' in error &&
      String((error as { statusCode?: unknown }).statusCode) === '404'
    ) {
      return null;
    }
    if (error.message.toLowerCase().includes('not found')) return null;
    throw error;
  }
  const buf = await data.arrayBuffer();
  return new Uint8Array(buf);
}

export async function uploadSnapshot(
  boardId: string,
  doc: Y.Doc,
): Promise<{ size: number }> {
  const bytes = Y.encodeStateAsUpdate(doc);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath(boardId), bytes, {
      upsert: true,
      contentType: 'application/octet-stream',
      cacheControl: '0',
    });
  if (error) throw error;

  await supabase
    .from('boards')
    .update({
      storage_path: objectPath(boardId),
      ydoc_size: bytes.byteLength,
    })
    .eq('id', boardId);

  return { size: bytes.byteLength };
}

export async function applyRemoteSnapshot(
  boardId: string,
  doc: Y.Doc,
): Promise<{ loaded: boolean; size: number }> {
  const bytes = await downloadSnapshot(boardId);
  if (!bytes) return { loaded: false, size: 0 };
  Y.applyUpdate(doc, bytes);
  return { loaded: true, size: bytes.byteLength };
}
