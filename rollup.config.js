import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import dts from "rollup-plugin-dts";

const plugins = [
  resolve(),
  commonjs(),
  typescript({
    compilerOptions: {
      declaration: false,
      outDir: undefined,
    },
  }),
];

const entries = [
  { name: "index", input: "src/index.ts" },
  { name: "bolt11", input: "src/bolt11/index.ts" },
  { name: "fiat", input: "src/fiat/index.ts" },
  { name: "l402", input: "src/l402/index.ts" },
  { name: "lnurl", input: "src/lnurl/index.ts" },
  { name: "podcasting2", input: "src/podcasting2/index.ts" },
];

const subBundles = entries.flatMap(({ name, input }) => [
  {
    input,
    plugins,
    output: {
      file: `dist/esm/${name}.js`,
      format: "esm",
      sourcemap: true,
    },
  },
  {
    input,
    plugins,
    output: {
      file: `dist/cjs/${name}.cjs`,
      format: "cjs",
      sourcemap: true,
    },
  },
  {
    input,
    plugins: [dts()],
    output: {
      file: `dist/types/${name}.d.ts`,
      format: "es",
    },
  },
]);

const umdBundle = {
  input: "src/index.ts",
  plugins: [...plugins, terser()],
  output: {
    file: "dist/lightning-tools.umd.js",
    format: "umd",
    name: "LightningTools",
    sourcemap: true,
  },
};

export default [...subBundles, umdBundle];
