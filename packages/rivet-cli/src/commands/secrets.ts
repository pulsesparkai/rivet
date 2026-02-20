import { Command } from 'commander';
import * as readline from 'readline';
import { SecretStore } from '@pulsesparkai/core';
import { theme, divider } from '../ui/theme';

export const secretsCommand = new Command('secrets')
  .description('Manage encrypted secret storage (AES-256-GCM, local only)');

secretsCommand
  .command('set <name>')
  .description('Store an encrypted secret (e.g. API key)')
  .action(async (name: string) => {
    const cwd = process.cwd();
    const store = new SecretStore(cwd);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const value = await new Promise<string>((resolve) => {
      process.stdout.write(theme.dim(`  Enter value for ${name}: `));
      rl.question('', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });

    if (!value) {
      console.log(theme.error(' Empty value. Nothing stored.'));
      return;
    }

    store.set(name, value);
    console.log(theme.success(` Secret "${name}" stored (encrypted with AES-256-GCM).`));
    console.log(theme.dim('  Stored in: .rivet/secrets.enc'));
    console.log(theme.dim('  Rivet will check this store when resolving API key env vars.'));
  });

secretsCommand
  .command('get <name>')
  .description('Check if a secret exists (never prints the value)')
  .action((name: string) => {
    const cwd = process.cwd();
    const store = new SecretStore(cwd);

    if (store.has(name)) {
      console.log(theme.success(` Secret "${name}" exists.`));
    } else {
      console.log(theme.warning(` Secret "${name}" not found.`));
    }
  });

secretsCommand
  .command('list')
  .description('List all stored secret names')
  .action(() => {
    const cwd = process.cwd();
    const store = new SecretStore(cwd);
    const names = store.list();

    if (names.length === 0) {
      console.log(theme.dim(' No secrets stored. Use `rivet secrets set <name>` to add one.'));
      return;
    }

    console.log(theme.bold(' Stored Secrets:'));
    console.log(divider());
    for (const name of names) {
      console.log(`  ${theme.highlight(name)}`);
    }
    console.log(divider());
    console.log(theme.dim(` ${names.length} secret(s) stored in .rivet/secrets.enc`));
  });

secretsCommand
  .command('delete <name>')
  .description('Remove a stored secret')
  .action((name: string) => {
    const cwd = process.cwd();
    const store = new SecretStore(cwd);

    if (store.delete(name)) {
      console.log(theme.success(` Secret "${name}" deleted.`));
    } else {
      console.log(theme.warning(` Secret "${name}" not found.`));
    }
  });
