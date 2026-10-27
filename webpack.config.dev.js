const path = require('path');
const { merge } = require('webpack-merge');
const common = require('./webpack.config.common.js');

module.exports = merge(common, {
    mode: 'development',
    devtool: 'eval-source-map',
    devServer: {
        static: {
            directory: __dirname,
            // reload the page when the game data or assets change; the bundle is handled by webpack
            watch: {
                ignored: [
                    path.resolve(__dirname, 'dist'),
                    path.resolve(__dirname, 'site'),
                    path.resolve(__dirname, 'node_modules'),
                    path.resolve(__dirname, '.git'),
                    path.resolve(__dirname, '.claude'),
                    path.resolve(__dirname, 'code_docs'),
                    path.resolve(__dirname, 'scripts'),
                    path.resolve(__dirname, 'package.json'),
                    path.resolve(__dirname, 'package-lock.json'),
                ],
            },
        },
        compress: true,
        liveReload: true,
        open: true,
        port: 9000,
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: [{
                    loader: 'ts-loader',
                    options: {
                        configFile: "tsconfig.json"
                    }
                }],
                exclude: /node_modules/,
            },
        ],
    }
});
