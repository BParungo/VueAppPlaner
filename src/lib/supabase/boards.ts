import { supabase } from './client';

export interface Board {
  id: string;
  name: string;
  storage_path: string | null;
  ydoc_size: number;
  created_at: string;
  updated_at: string;
}

export async function createBoard(name = 'Untitled Board'): Promise<Board> {
  const { data, error } = await supabase
    .from('boards')
    .insert({ name })
    .select('*')
    .single();
  if (error) throw error;
  return data as Board;
}

export async function getBoard(id: string): Promise<Board | null> {
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as Board) ?? null;
}

export async function renameBoard(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('boards').update({ name }).eq('id', id);
  if (error) throw error;
}
