// 오답노트 실데이터(로그인 시). 게스트면 null(또는 no-op) → 화면 폴백.
import { supabase } from './supabaseClient';

// [{ question_id, content_key, question_type, stem_ja, stem_ruby, explanation,
//    correct_text, correct_ruby, latest_outcome, wrong_count, last_at }] | null
export async function loadWrongNotes() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc('load_wrong_notes');
  if (error) return null;
  return data;
}

// "이제 알아요" — 졸업 처리. 게스트면 no-op.
export async function graduateWrongNote(questionId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.rpc('graduate_wrong_note', { p_question_id: questionId });
}
