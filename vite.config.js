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
      writeBundle(options) {
        const outDir = options.dir || resolve(__dirname, 'dist');
        
        // Copy manifest
        copyFileSync('src/manifest.json', `${outDir}/manifest.json`);
        
        // Copy assets
        mkdirSync(`${outDir}/assets/icons`, { recursive: true });
        cpSync('src/assets/icons', `${outDir}/assets/icons`, { recursive: true });
        
        // Copy lib
        mkdirSync(`${outDir}/lib`, { recursive: true });
        copyFileSync('src/lib/sjcl.min.js', `${outDir}/lib/sjcl.min.js`);
        
        // Copy styles
        mkdirSync(`${outDir}/styles/font`, { recursive: true });
        copyFileSync('src/styles/main.css', `${outDir}/styles/main.css`);
        copyFileSync('src/styles/fontawesome.css', `${outDir}/styles/fontawesome.css`);
        cpSync('src/styles/font', `${outDir}/styles/font`, { recursive: true });
        
        // Copy webfonts (FontAwesome)
        cpSync('src/webfonts', `${outDir}/webfonts`, { recursive: true });
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
  test: {
    include: ['__tests__/**/*.test.js'],
    setupFiles: ['__tests__/setup.js'],
    coverage: {
      provider: 'v8'
    }
  },
});
