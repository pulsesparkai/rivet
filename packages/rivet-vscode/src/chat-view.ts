import * as vscode from 'vscode';

export class RivetChatViewProvider implements vscode.WebviewViewProvider {
  private extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === 'run') {
        const terminal = vscode.window.createTerminal('Rivet');
        terminal.sendText(`npx @pulsesparkai/rivet run "${msg.task.replace(/"/g, '\\"')}"`);
        terminal.show();
      }
      if (msg.type === 'dashboard') {
        vscode.commands.executeCommand('rivet.openDashboard');
      }
      if (msg.type === 'openFile') {
        const doc = await vscode.workspace.openTextDocument(msg.path);
        vscode.window.showTextDocument(doc);
      }
    });
  }

  private getHtml(_webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background);
    padding: 12px;
  }
  .header {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .header-icon { font-size: 16px; }
  .input-row {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
  }
  input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid var(--vscode-input-border);
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border-radius: 4px;
    font-size: 12px;
    outline: none;
  }
  input:focus { border-color: var(--vscode-focusBorder); }
  button {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
  }
  .btn-primary {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }
  .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
  .btn-secondary {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }
  .actions { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
  .action-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-widget-border, transparent);
    border-radius: 6px;
    color: var(--vscode-foreground);
    cursor: pointer;
    text-align: left;
    font-size: 12px;
    transition: background 0.15s;
  }
  .action-btn:hover { background: var(--vscode-list-hoverBackground); }
  .action-icon { font-size: 16px; width: 20px; text-align: center; }
  .action-label { font-weight: 500; }
  .action-desc { color: var(--vscode-descriptionForeground); font-size: 11px; margin-top: 2px; }
  .messages { margin-top: 16px; }
  .msg {
    padding: 8px;
    margin-bottom: 6px;
    border-radius: 6px;
    font-size: 12px;
    background: var(--vscode-editor-background);
    border-left: 3px solid var(--vscode-textLink-foreground);
  }
  .msg-info { color: var(--vscode-descriptionForeground); font-size: 11px; }
</style>
</head>
<body>
  <div class="header"><span class="header-icon">&#9889;</span> Rivet Agent</div>

  <div class="input-row">
    <input id="task-input" placeholder="Ask Rivet to do something..." />
    <button class="btn-primary" onclick="runTask()">Run</button>
  </div>

  <div class="actions">
    <button class="action-btn" onclick="openDashboard()">
      <span class="action-icon">&#127760;</span>
      <div>
        <div class="action-label">Open Dashboard</div>
        <div class="action-desc">Launch the local Rivet web dashboard</div>
      </div>
    </button>
    <button class="action-btn" onclick="runChat()">
      <span class="action-icon">&#128172;</span>
      <div>
        <div class="action-label">Interactive Chat</div>
        <div class="action-desc">Start a chat session in the terminal</div>
      </div>
    </button>
  </div>

  <div class="messages" id="messages"></div>

  <script>
    const vscode = acquireVsCodeApi();
    const input = document.getElementById('task-input');

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runTask();
    });

    function runTask() {
      const task = input.value.trim();
      if (!task) return;
      input.value = '';
      addMsg('Sent: ' + task);
      vscode.postMessage({ type: 'run', task });
    }

    function openDashboard() {
      vscode.postMessage({ type: 'dashboard' });
    }

    function runChat() {
      vscode.postMessage({ type: 'run', task: '__chat__' });
    }

    function addMsg(text) {
      const container = document.getElementById('messages');
      const el = document.createElement('div');
      el.className = 'msg';
      el.textContent = text;
      container.prepend(el);
    }
  </script>
</body>
</html>`;
  }
}
