/* eslint-disable max-len */
/**
 * Build config for development process that uses Hot-Module-Replacement
 * https://webpack.js.org/concepts/hot-module-replacement/
 */
import fs from 'fs';
import path from 'path';
import {spawn, execSync} from 'child_process';
import chalk from 'chalk';
import webpack from 'webpack';
import merge from 'webpack-merge';
import ExtractTextPlugin from 'extract-text-webpack-plugin';
import baseConfig from './webpack.config.base';

const port = process.env.PORT || 3940;
const publicPath = `http://localhost:${port}/dist`;
const dll = path.resolve(process.cwd(), 'dll');
const manifest = path.resolve(dll, 'vendor.json');

process.traceDeprecation = true

if (!(fs.existsSync(dll) && fs.existsSync(manifest))) {
  console.log(chalk.black.bgYellow.bold(
    'Building DLL files...'
  ));
  execSync('npm run build-dll');
}

export default merge.smart(baseConfig, {
  mode: 'development',
  devtool: 'source-map',

  entry: [
    //'@babel/polyfill',
    '@hot-loader/react-dom',
    `webpack-dev-server/client?http://localhost:${port}/`,
    'webpack/hot/only-dev-server',
    path.join(__dirname, 'app/index.tsx'),
  ],

  output: {
    publicPath: `http://localhost:${port}/dist/`
  },

  resolve: {
    alias: {
      'react-dom': '@hot-loader/react-dom'
    },
  },

  plugins: [
    new webpack.DllReferencePlugin({
      context: process.cwd(),
      manifest: require(manifest),
      sourceType: 'var',
    }),
    // https://webpack.js.org/concepts/hot-module-replacement/
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    // turn debug mode on.
    new webpack.LoaderOptionsPlugin({
      debug: true
    }),
    new ExtractTextPlugin({
      filename: '[name].css'
    }),
  ],

  /**
   * https://github.com/chentsulin/webpack-target-electron-renderer#how-this-module-works
   */
  target: 'electron-renderer',
  devServer: {
    port,
    hot: true,
    inline: false,
    historyApiFallback: true,
    contentBase: path.join(__dirname, 'dist'),
    publicPath,
    before() {
      if (process.env.START_HOT) {
        spawn('npm', ['run', 'start-hot'], { shell: true, env: process.env, stdio: 'inherit' })
          .on('close', code => process.exit(code))
          .on('error', spawnError => console.error(spawnError));
      }
    }
  },
});
