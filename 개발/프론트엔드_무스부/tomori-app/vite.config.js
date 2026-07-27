import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// react-native-web 를 브라우저에서 돌리기 위한 설정.
//  · 'react-native' import → 'react-native-web' 로 별칭 (RN 컴포넌트가 웹으로)
//  · RN/RNW 소스가 Flow 타입·JSX 를 .js 확장자로 들고 있어, 사전 번들과
//    .js 안 JSX 를 esbuild 가 처리하도록 지정.
export default defineConfig({
  plugins: [react()],
  define: {
    // RN 내부가 참조하는 전역. 없으면 런타임에서 터진다.
    global: 'window',
    __DEV__: 'true',
    'process.env.NODE_ENV': JSON.stringify('development'),
  },
  resolve: {
    alias: { 'react-native': 'react-native-web' },
    extensions: ['.web.js', '.js', '.jsx', '.json'],
  },
  optimizeDeps: {
    include: ['react-native-web'],
    esbuildOptions: { loader: { '.js': 'jsx' } },
  },
  server: { port: 5599, host: true },
});
