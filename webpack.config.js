const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { ServiceWorkerPlugin } = require('./build/service-worker-plugin');

// MIT requires the notice to ship with the code. It is added to the JS after minification,
// so it stays in the scripts (visible in dev tools) and never shows in the UI or exports.
const LICENSE_BANNER = `/*!
 * PDF Table Extractor
 *
 * Table detection algorithms ported from pdfplumber (https://github.com/jsvine/pdfplumber).
 *
 * The MIT License (MIT)
 * Copyright (c) 2015, Jeremy Singer-Vine
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software
 * and associated documentation files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
 * BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */`;

/** @type {import('webpack').Configuration} */
module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';

  return {
    entry: './src/main.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].[contenthash:8].js',
      // Lazy chunks: the extraction worker (pdf.js) and the XLSX writer (ExcelJS).
      chunkFilename: '[name].[contenthash:8].js',
      clean: true,
    },
    resolve: {
      extensions: ['.ts', '.js', '.mjs'],
      // pdf.js ships ES modules; tell webpack to use the browser field
      conditionNames: ['browser', 'import', 'require'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          // Only type-check files that are actually bundled; tests are covered by `npm run typecheck`.
          use: { loader: 'ts-loader', options: { onlyCompileBundledFiles: true } },
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
        // pdf.js ships .mjs files with extension-less internal imports
        {
          test: /\.m?js$/,
          resolve: { fullySpecified: false },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './index.html',
        // Inject CSP only in production. In dev the HMR client needs unsafe-eval
        // which the strict CSP blocks — easier to omit it entirely during development.
        ...(isProd ? {
          meta: {
            'Content-Security-Policy': {
              'http-equiv': 'Content-Security-Policy',
              content: [
                "default-src 'none'",
                "script-src 'self' blob:",
                "worker-src 'self' blob:",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data:",
                "font-src 'self'",
                "connect-src 'self'",
                "base-uri 'none'",
                "form-action 'none'",
              ].join('; '),
            },
          },
        } : {}),
      }),
      new MiniCssExtractPlugin({ filename: '[name].[contenthash:8].css' }),
      // Service worker at the root (its own file name must not be content-hashed).
      new ServiceWorkerPlugin({ template: path.resolve(__dirname, 'public/sw.js'), cachePrefix: 'pdf-tables-' }),
      new webpack.BannerPlugin({
        banner: LICENSE_BANNER,
        raw: true,
        test: /\.js$/,
        stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
      }),
    ],
    optimization: {
      minimizer: ['...', new CssMinimizerPlugin()],
    },
    devServer: {
      port: 3000,
      hot: true,
      // Required for service worker scope to work
      headers: { 'Service-Worker-Allowed': '/' },
    },
    // No source maps in production: dist/ is deployed as-is to GitHub Pages.
    devtool: isProd ? false : 'eval-source-map',
  };
};
