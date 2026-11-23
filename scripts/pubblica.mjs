import {
  optionsFromArguments,
  postsFromOptions,
  workspaceFromOptions,
} from './workspace-cli.mjs';
import { publishDraft } from './workspace-lib.mjs';

const options = optionsFromArguments();
const postFile = await publishDraft({
  workspace: workspaceFromOptions(options),
  postsDirectory: postsFromOptions(options),
  slug: options.get('--slug'),
  approvedBy: options.get('--approved-by'),
});
console.log(
  `Racconto pubblicato in ${postFile}. Apri una pull request: il merge su main lo mette online.`,
);
