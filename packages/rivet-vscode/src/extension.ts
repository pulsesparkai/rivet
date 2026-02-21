import * as vscode from 'vscode';
import { RivetChatViewProvider } from './chat-view';

export function activate(context: vscode.ExtensionContext) {
  const chatProvider = new RivetChatViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('rivet-chat', chatProvider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('rivet.openDashboard', () => {
      const terminal = vscode.window.createTerminal('Rivet Dashboard');
      terminal.sendText('npx @pulsesparkai/rivet dashboard');
      terminal.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('rivet.startAgent', async () => {
      const task = await vscode.window.showInputBox({
        prompt: 'What should Rivet do?',
        placeHolder: 'e.g. refactor the auth module to use JWT',
      });
      if (task) {
        const terminal = vscode.window.createTerminal('Rivet Agent');
        terminal.sendText(`npx @pulsesparkai/rivet run "${task.replace(/"/g, '\\"')}"`);
        terminal.show();
      }
    })
  );
}

export function deactivate() {}
