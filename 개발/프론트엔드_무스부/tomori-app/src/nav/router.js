import { useState, useCallback, useMemo } from 'react';

/**
 * 아주 가벼운 스택 네비게이션 훅 (FE 본편 첫 조각).
 *
 * 왜 손수 만드나 (설계 승인 2026-07-28):
 *  · react-navigation 은 이 환경(RN Web + Vite)에서 번들이 불안정(진행상태.md 경고).
 *  · 지금 필요한 건 push/pop 스택 하나뿐 — 라이브러리는 과함.
 *  · Expo 정식 이식 때 react-navigation(native-stack)으로 교체한다.
 *    라우트 = 문자열 name + params 객체 형태라 이식 비용이 작다(예고된 교체 지점).
 *
 * 사용:
 *   const nav = useRouter('home');
 *   nav.current            // { name, params }
 *   nav.push('jlptHub')    // 스택에 쌓기
 *   nav.push('wordSession', { level: 'N5' })
 *   nav.pop()              // 뒤로 (루트면 무시)
 *   nav.replace(name, p)   // 현재 화면 교체(스택 깊이 유지)
 *   nav.reset(name)        // 스택을 [name] 하나로
 *   nav.canGoBack          // 뒤로 갈 수 있나(‹ 표시 여부)
 */
export function useRouter(initial = 'home', initialParams = {}) {
  const [stack, setStack] = useState([{ name: initial, params: initialParams }]);

  const push = useCallback((name, params = {}) => {
    setStack((s) => [...s, { name, params }]);
  }, []);

  const pop = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  const replace = useCallback((name, params = {}) => {
    setStack((s) => [...s.slice(0, -1), { name, params }]);
  }, []);

  const reset = useCallback((name, params = {}) => {
    setStack([{ name, params }]);
  }, []);

  const current = stack[stack.length - 1];
  const canGoBack = stack.length > 1;

  return useMemo(
    () => ({ current, canGoBack, push, pop, replace, reset }),
    [current, canGoBack, push, pop, replace, reset],
  );
}
