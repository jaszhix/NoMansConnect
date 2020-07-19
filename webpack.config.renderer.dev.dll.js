/**
 * Builds the DLL for development electron renderer process
 */

import webpack from 'webpack';
import path from 'path';
import {merge} from 'webpack-merge';
import baseConfig from './webpack.config.base';
import {dependencies} from './package.json';

const dist = path.resolve(process.cwd(), 'dll');

export default merge(baseConfig, {
  mode: 'none',
  context: process.cwd(),

  devtool: 'eval',

  target: 'electron-renderer',

  externals: ['fsevents', 'crypto-browserify'],

  resolve: {
    modules: [
      'app',
    ],
  },

  entry: {
    vendor: [
      ...Object.keys(dependencies || {})
    ]
    .filter(dependency => dependency !== 'font-awesome'),
  },

  output: {
    library: 'vendor',
    path: dist,
    filename: '[name].dll.js',
    libraryTarget: 'var'
  },

  plugins: [
    new webpack.DllPlugin({
      path: path.join(dist, '[name].json'),
      name: '[name]',
    }),
    new webpack.LoaderOptionsPlugin({
      debug: true,
      options: {
        context: path.resolve(process.cwd(), 'app'),
        output: {
          path: path.resolve(process.cwd(), 'dll'),
        },
      },
    })
  ],
});
