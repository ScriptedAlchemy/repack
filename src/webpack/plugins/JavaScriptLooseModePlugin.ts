import path from 'path';
import webpack from 'webpack';
import { WebpackPlugin } from '../../types';

export interface JavaScriptLooseModeConfig {
  include: boolean | Array<string | RegExp> | ((filename: string) => boolean);
}

/**
 * Enable JavaScript loose mode, by removing `use strict` directives from the code.
 * This plugin should only be used for compatibility reasons with Metro, where some libraries
 * might not work in JavaScript Strict mode.
 */
export class JavaScriptLooseModePlugin implements WebpackPlugin {
  shouldUseLoosMode: (filename: string) => boolean;

  /**
   * Constructs new `JavaScriptLooseModePlugin`.
   *
   * @param config - Plugin config
   *
   * @param config.include - Pattern for matching modules that should be run in loose mode:
   * - `boolean` - enables or disables loose mode for all the modules within a bundle,
   * - `string[]` - enables loose mode for only modules specified within the array,
   * - `RegExp[]` - enables loose mode for only modules matching any of the regex within the array,
   * - `(filename: string) => boolean` - enables loose mode for only modules, for which the function returns `true`.
   */
  constructor({ include }: JavaScriptLooseModeConfig) {
    if (include === true) {
      this.shouldUseLoosMode = () => true;
    } else if (Array.isArray(include)) {
      this.shouldUseLoosMode = (filename: string) => {
        return (include as Array<string | RegExp>).some((element) => {
          if (typeof element === 'string') {
            if (!path.isAbsolute(element)) {
              throw new Error(
                `${element} in 'looseMode' property must be an absolute path or regex`
              );
            }
            return element === filename;
          }

          return element.test(filename);
        });
      };
    } else if (typeof include === 'function') {
      this.shouldUseLoosMode = include;
    } else {
      this.shouldUseLoosMode = () => false;
    }
  }

  apply(compiler: webpack.Compiler) {
    compiler.hooks.make.tap(
      'JavaScriptLooseModePlugin',
      (compilation: webpack.Compilation) => {
        compilation.moduleTemplates.javascript.hooks.render.tap(
          'JavaScriptLooseModePlugin',
          (
            moduleSource: webpack.sources.Source,
            { resource }: { resource: string }
          ) => {
            const useLooseMode = this.shouldUseLoosMode(resource);
            if (!useLooseMode) {
              return moduleSource;
            }

            const source = moduleSource.source().toString();
            const match = source.match(/['"]use strict['"]/);
            if (!match || match.index === undefined) {
              return moduleSource;
            }
            const replacement = new webpack.sources.ReplaceSource(moduleSource);
            replacement.replace(match.index, match.index + match[0].length, '');
            return replacement;
          }
        );
      }
    );
  }
}