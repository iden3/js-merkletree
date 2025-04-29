import commonJS from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import tsConfig from '../tsconfig.json' with { type: 'json' };
import packageJson from '../package.json' with { type: 'json' };

const external = [
  ...Object.keys(packageJson.peerDependencies).filter((key) => key.startsWith('@iden3/'))
];

const config = {
  input: 'src/index.ts',
  external,
  output: [
    {
      format: 'es',
      file: 'dist/browser/esm/index.js',
      sourcemap: true
    }
  ],
  plugins: [
    typescript({
      compilerOptions: {
        ...tsConfig.compilerOptions
      }
    }),
    commonJS(),
    nodeResolve({
      browser: true
    }),
    terser()
  ],
  treeshake: {
    preset: 'smallest'
  }
};

export default [
  config,
  {
    ...config,
    external: [],
    output: [
      {
        format: 'iife',
        file: 'dist/browser/umd/index.js',
        name: 'Iden3Merkletree',
        sourcemap: true
      }
    ]
  }
];
