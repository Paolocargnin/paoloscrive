import { optionsFromArguments, postsFromOptions } from './workspace-cli.mjs';
import { signTranslation } from './workspace-lib.mjs';

const options = optionsFromArguments();
const file = await signTranslation({
  postsDirectory: postsFromOptions(options),
  slug: options.get('--slug'),
  lang: options.get('--lang'),
  signedBy: options.get('--signed-by'),
});
console.log(
  `Traduzione firmata: ${file}. L'avviso sparisce alla prossima build.`,
);
