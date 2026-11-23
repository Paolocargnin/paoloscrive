import {
  optionsFromArguments,
  workspaceFromOptions,
} from './workspace-cli.mjs';
import { createNote } from './workspace-lib.mjs';

const options = optionsFromArguments();
const directory = await createNote({
  workspace: workspaceFromOptions(options),
  slug: options.get('--slug'),
});
console.log(`Nota creata in ${directory}.`);
