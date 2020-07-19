/**
 * Build config for electron 'Renderer Process' file
 */

import fs from 'fs';
import path from 'path';
import webpack from 'webpack';
import ExtractTextPlugin from 'extract-text-webpack-plugin';
import {BundleAnalyzerPlugin} from 'webpack-bundle-analyzer';
import {merge} from 'webpack-merge';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import SentryWebpackPlugin from '@sentry/webpack-plugin';
import baseConfig from './webpack.config.base';

const config = merge(baseConfig, {
  mode: 'production',
  devtool: 'source-map',

  entry: ['./app/index'],

  output: {
    path: path.join(__dirname, 'app/dist'),
    publicPath: '../dist/'
  },

  plugins: [
    new ExtractTextPlugin({filename: 'style.css', allChunks: false}),

    /**
     * Dynamically generate index.html page
     */
    new HtmlWebpackPlugin({
      filename: '../app.html',
      template: 'app/app.html',
      inject: false
    }),

    new BundleAnalyzerPlugin({
      analyzerMode: process.env.OPEN_ANALYZER === 'true' ? 'server' : 'disabled',
      openAnalyzer: process.env.OPEN_ANALYZER === 'true'
    }),
  ],

  // https://github.com/chentsulin/webpack-target-electron-renderer#how-this-module-works
  target: 'electron-renderer',

  optimization: {
    splitChunks: {
      chunks: 'async',
      minSize: 30000,
      minChunks: 2,
      maxAsyncRequests: 5,
      maxInitialRequests: 3,
      name: true,
      cacheGroups: {
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true,
        },
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          chunks: 'all'
        }
      }
    },
    minimizer: [
      new TerserPlugin({
        parallel: true,
        sourceMap: true,
        terserOptions: {
          ecma: undefined,
          warnings: false,
          parse: {},
          compress: {
            drop_console: true,
            drop_debugger: true,
          },
          sourceMap: true,
          mangle: false,
          module: false,
          output: null,
          toplevel: false,
          nameCache: null,
          ie8: false,
          keep_classnames: undefined,
          keep_fnames: true,
          safari10: false,
        },
      }),
    ],
  },
});

if (fs.existsSync('./.sentryclirc')) {
  config.plugins.push(
    new SentryWebpackPlugin({
      include: './dist',
      ignoreFile: '.sentrycliignore',
      configFile: 'sentry.properties'
    })
  );
}

export default config;