const globals = require("globals");
const typescriptParser = require("@typescript-eslint/parser");
const typescriptPlugin = require("@typescript-eslint/eslint-plugin");
const importPlugin = require("eslint-plugin-import");
const googleConfig = require("eslint-config-google");

module.exports = [
  // Base configuration for all files
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      "import": importPlugin,
    },
    rules: {
      ...googleConfig.rules,
      "quotes": ["error", "double"],
      "import/no-unresolved": 0,
      "indent": ["error", 2],
      // Relaxing some rules that are causing issues
      "max-len": ["warn", { "code": 120 }], // Increase line length limit
      "valid-jsdoc": "off", // Disable JSDoc requirement
      "object-curly-spacing": ["error", "always"], // Consistent with existing code
    },
    // Globally ignored files and directories
    ignores: [
      "node_modules/**",
      ".eslintrc.cjs",
      "eslint.config.js",
      "lib/**", // Ignore the built files
      "generated/**", // Ignore generated files
      "scripts/**",
    ],
  },
  
  // TypeScript-specific configuration (only applies to .ts files)
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: ["tsconfig.json", "tsconfig.dev.json"],
      },
    },
    plugins: {
      "@typescript-eslint": typescriptPlugin,
    },
    rules: {
      ...typescriptPlugin.configs.recommended.rules,
      // Disable TypeScript JSDoc requirements
      "@typescript-eslint/require-jsdoc": "off",
      "@typescript-eslint/valid-jsdoc": "off",
    },
  },
]; 