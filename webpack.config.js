const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

/** @type {import('webpack').Configuration} */
module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';

  return {
    entry: './src/main.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].[contenthash:8].js',
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
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
        // pdf.js internal workers use .mjs files — let webpack handle them
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
      new CopyPlugin({
        patterns: [
          // Service worker at root (must not be content-hashed)
          { from: 'public/sw.js', to: 'sw.js' },
          // pdf.js web worker — must be served as a top-level file
          {
            from: 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
            to: 'pdf.worker.min.mjs',
          },
        ],
      }),
    ],
    optimization: {
      minimizer: ['...', new CssMinimizerPlugin()],
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      },
    },
    devServer: {
      port: 3000,
      hot: true,
      // Required for service worker scope to work
      headers: { 'Service-Worker-Allowed': '/' },
    },
    devtool: isProd ? 'source-map' : 'eval-source-map',
  };
};
