/**
 * Base webpack config used across other specific configs
 */

import path from 'path';
import webpack from 'webpack';
import {dependencies as externals} from './app/package.json';
import {readFileSync} from 'fs-extra-p';

// babel-loader@8 seems to not use .babelrc implicitly
const babelConfig = JSON.parse(readFileSync('./.babelrc'));

export default {
  module: {
    rules: [
      {
        test: /\.(js|jsx|mjs|ts|tsx)$/,
        exclude: /(node_modules|bower_components)/,
        use: [{
          loader: 'babel-loader',
          options: babelConfig
        }],
      },
      {
        test: /\.js$/,
        use: ['source-map-loader'],
        enforce: 'pre'
      },
    ]
  },

  output: {
    path: path.join(__dirname, 'app'),
    filename: 'bundle.js',
    // https://github.com/webpack/webpack/issues/1114
    libraryTarget: 'commonjs2'
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: ['.js', '.jsx', '.tsx', '.ts', '.json'],
    modules: [
      path.join(__dirname, 'app'),
      'node_modules',
    ],
  },

  plugins: [
    new webpack.NamedModulesPlugin(),
    new webpack.optimize.ModuleConcatenationPlugin()
  ],

  externals: Object.keys(externals || {})
};
