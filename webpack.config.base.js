/**
 * Base webpack config used across other specific configs
 */

import path from 'path';
import webpack from 'webpack';
import ExtractTextPlugin from 'extract-text-webpack-plugin';
import LodashModuleReplacementPlugin from 'lodash-webpack-plugin';
import LodashLoader from 'lodash-loader';
import {dependencies as externals} from './app/package.json';
import {readFileSync} from 'fs-extra-p';

// babel-loader@8 seems to not use .babelrc implicitly
const babelConfig = JSON.parse(readFileSync('./.babelrc'));

const {NODE_ENV} = process.env;
const PROD = NODE_ENV === 'production';

if (!PROD) {
  babelConfig.plugins.push('react-hot-loader/babel');
}

const aliases = Object.assign({
  underscore: 'lodash'
}, LodashLoader.createLodashAliases());

let cssLoaders1 = [
  {
    loader: 'css-loader',
    options: {
      sourceMap: true,
      importLoaders: 1
    },
  },
];

let cssLoaders2 = [
  {
    loader: 'css-loader',
    options: {
      modules: true,
      sourceMap: true,
      importLoaders: 1,
      localIdentName: '[name]__[local]__[hash:base64:5]',
    }
  },
];

let scssLoaders1 = [
  {
    loader: 'css-loader',
    options: {
      sourceMap: true,
      importLoaders: 1
    },
  },
  {
    loader: 'sass-loader',
    options: {
      sourceMap: true,
      sassOptions: {
        includePaths: [
          path.join(__dirname, 'node_modules')
        ],
        outputStyle: PROD ? 'compressed' : 'expanded'
      }
    }
  }
];

let scssLoaders2 = [
  {
    loader: 'css-loader',
    options: {
      modules: true,
      sourceMap: true,
      importLoaders: 1,
      localIdentName: '[name]__[local]__[hash:base64:5]',
    }
  },
  {
    loader: 'sass-loader',
    options: {
      sourceMap: true,
      sassOptions: {
        includePaths: [
          path.join(__dirname, 'node_modules')
        ],
        outputStyle: PROD ? 'compressed' : 'expanded'
      }
    }
  }
];

if (!PROD) {
  cssLoaders1 = ['style-loader'].concat(cssLoaders1);
  cssLoaders2 = ['style-loader'].concat(cssLoaders2);
  scssLoaders1 = ['style-loader'].concat(scssLoaders1);
  scssLoaders2 = ['style-loader'].concat(scssLoaders2);
}

export default {
  module: {
    rules: [
      {
        test: /\.worker\.ts$/,
        use: [
          {
            loader: 'worker-loader',
            options: {
              name: '[name].js',
            }
          }
        ]
      },
      {
        test: /\.(js|jsx|mjs|ts|tsx)$/,
        exclude: /(node_modules|bower_components)/,
        use: [
          {
            loader: 'lodash-loader'
          },
          {
            loader: 'babel-loader',
            options: babelConfig
          }
        ],
      },
      {
        test: /\.(js|ts|tsx)$/,
        use: ['source-map-loader'],
        enforce: 'pre'
      },
      {
        test: /\.global\.css$/,
        use: PROD ? ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: cssLoaders1
        }) : cssLoaders1,
      },
      {
        test: /^((?!\.global).)*\.css$/,
        use: PROD ? ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: cssLoaders2
        }) : cssLoaders2,
      },
      // Add SASS support  - compile all .global.scss files and pipe it to style.css
      {
        test: /\.global\.scss$/,
        use: PROD ? ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: scssLoaders1
        }) : scssLoaders1,
      },
      // Add SASS support  - compile all other .scss files and pipe it to style.css
      {
        test: /^((?!\.global).)*\.scss$/,
        use: PROD ? ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: scssLoaders2
        }) : scssLoaders2,
      },
      // WOFF Font
      {
        test: /\.woff(\?v=\d+\.\d+\.\d+)?$/,
        use: {
          loader: 'url-loader',
          options: {
            limit: 10000,
            mimetype: 'application/font-woff',
          }
        },
      },
      // WOFF2 Font
      {
        test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/,
        use: {
          loader: 'url-loader',
          options: {
            limit: 10000,
            mimetype: 'application/font-woff',
          }
        }
      },
      // TTF Font
      {
        test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
        use: {
          loader: 'url-loader',
          options: {
            limit: 10000,
            mimetype: 'application/octet-stream'
          }
        }
      },
      // EOT Font
      {
        test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
        use: 'file-loader',
      },
      // SVG Font
      {
        test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        use: {
          loader: 'url-loader',
          options: {
            limit: 10000,
            mimetype: 'image/svg+xml',
          }
        }
      },
      // Common Image Formats
      {
        test: /\.(?:ico|gif|png|jpg|jpeg|webp)$/,
        use: 'url-loader',
      }
    ]
  },

  output: {
    path: path.join(__dirname, 'app'),
    filename: 'bundle.js',
    // https://github.com/webpack/webpack/issues/1114
    libraryTarget: 'commonjs2',
    globalObject: 'this'
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
    alias: aliases
  },

  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
         NODE_ENV: JSON.stringify(NODE_ENV)
       }
    }),
    new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
    new LodashModuleReplacementPlugin({
      cloning: true,
      flattening: true,
      shorthands: true
    }),
    new webpack.NamedModulesPlugin(),
    new webpack.optimize.ModuleConcatenationPlugin(),
  ],

  externals: Object.keys(externals || {})
};
