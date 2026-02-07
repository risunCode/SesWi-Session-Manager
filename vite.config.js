import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, cpSync } from 'fs';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup.html'),
        background: resolve(__dirname, 'src/background.js'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  plugins: [
    {
      name: 'copy-extension-files',
      writeBundle(options, bundle) {
        const outDir = options.dir || '../dist';
        
        // Copy manifest
        copyFileSync('src/manifest.json', 'dist/manifest.json');
        
        // Copy assets
        mkdirSync('dist/assets/icons', { recursive: true });
        cpSync('src/assets/icons', 'dist/assets/icons', { recursive: true });
        
        // Copy lib
        mkdirSync('dist/lib', { recursive: true });
        copyFileSync('src/lib/sjcl.min.js', 'dist/lib/sjcl.min.js');
        
        // Copy styles
        mkdirSync('dist/styles/webfonts', { recursive: true });
        copyFileSync('src/styles/main.css', 'dist/styles/main.css');
        copyFileSync('src/styles/fontawesome.css', 'dist/styles/fontawesome.css');
        cpSync('src/styles/webfonts', 'dist/styles/webfonts', { recursive: true });
      }
    },
    {
      name: 'fix-html-output',
      generateBundle(options, bundle) {
        // Fix HTML file path - remove src/ prefix
        for (const fileName of Object.keys(bundle)) {
          if (fileName.startsWith('src/') && fileName.endsWith('.html')) {
            const newName = fileName.replace('src/', '');
            bundle[newName] = bundle[fileName];
            bundle[newName].fileName = newName;
            delete bundle[fileName];
          }
        }
      },
      transformIndexHtml(html) {
        // Inject sjcl.min.js before the closing body tag
        return html.replace('</body>', '<script src="./lib/sjcl.min.js"></script></body>');
      }
    }
  ],
});
