/**
 * Build config for electron 'Main Process' file
 */

import webpack from 'webpack';
import merge from 'webpack-merge';
import BabiliPlugin from 'babili-webpack-plugin';
//import UglifyJSPlugin from 'uglifyjs-webpack-plugin';
import baseConfig from './webpack.config.base';

export default merge(baseConfig, {
  devtool: 'source-map',

  entry: ['babel-polyfill', './app/main.development'],

  // 'main.js' in root
  output: {
    path: __dirname,
    filename: './app/main.js'
  },

  plugins: [
    /**
     * Babli is an ES6+ aware minifier based on the Babel toolchain (beta)
     */
    new BabiliPlugin(),
    /*new UglifyJSPlugin({
      sourceMap: false,
      mangle: false,
      compress: {
        warnings: false,
        drop_console: true,
        dead_code: true,
        unused: true,
        booleans: true,
        join_vars: true,
        negate_iife: true,
        sequences: true,
        properties: true,
        evaluate: true,
        loops: true,
        if_return: true,
        cascade: true,
        unsafe: true
      },
      output: {
        comments: false
      }
    }),*/

    /**
     * Create global constants which can be configured at compile time.
     *
     * Useful for allowing different behaviour between development builds and
     * release builds
     *
     * NODE_ENV should be production so that modules do not perform certain
     * development checks
     */
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production')
    })
  ],

  /**
   * Set target to Electron specific node.js env.
   * https://github.com/chentsulin/webpack-target-electron-renderer#how-this-module-works
   */
  target: 'electron-main',

  /**
   * Disables webpack processing of __dirname and __filename.
   * If you run the bundle in node.js it falls back to these values of node.js.
   * https://github.com/webpack/webpack/issues/2010
   */
  node: {
    __dirname: false,
    __filename: false
  },
});
