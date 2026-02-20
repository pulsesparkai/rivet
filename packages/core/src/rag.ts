import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';

const SKIP_DIRS = ['node_modules', '.git', 'dist', '.turbo', '.next', '__pycache__', '.rivet', '.pnpm-store'];
const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java', '.c', '.cpp', '.h',
  '.css', '.scss', '.html', '.json', '.yaml', '.yml', '.toml', '.md', '.sh', '.sql',
  '.vue', '.svelte', '.rb', '.php', '.swift', '.kt',
]);
const MAX_FILE_SIZE = 100_000;
const CHUNK_LINES = 40;
const CHUNK_OVERLAP = 8;

export interface CodeChunk {
  file: string;
  startLine: number;
  endLine: number;
  content: string;
}

interface IndexedChunk extends CodeChunk {
  termFreqs: Map<string, number>;
  magnitude: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && t.length < 60);
}

function computeTF(tokens: string[]): Map<string, number> {
  const freqs = new Map<string, number>();
  for (const t of tokens) {
    freqs.set(t, (freqs.get(t) || 0) + 1);
  }
  const max = Math.max(...freqs.values(), 1);
  for (const [k, v] of freqs) {
    freqs.set(k, v / max);
  }
  return freqs;
}

export class RepoIndex {
  private chunks: IndexedChunk[] = [];
  private docFreqs = new Map<string, number>();
  private totalDocs = 0;
  private indexed = false;

  constructor(private workspaceRoot: string) {}

  isIndexed(): boolean {
    return this.indexed;
  }

  async buildIndex(): Promise<number> {
    const ignorePatterns = SKIP_DIRS.map(d => `**/${d}/**`);
    const files = await fg('**/*', {
      cwd: this.workspaceRoot,
      ignore: ignorePatterns,
      absolute: false,
      onlyFiles: true,
    });

    const codeFiles = files.filter(f => CODE_EXTENSIONS.has(path.extname(f)));
    this.chunks = [];
    this.docFreqs = new Map();

    for (const file of codeFiles) {
      const fullPath = path.join(this.workspaceRoot, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.size > MAX_FILE_SIZE) continue;

        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i += CHUNK_LINES - CHUNK_OVERLAP) {
          const slice = lines.slice(i, i + CHUNK_LINES);
          if (slice.length === 0) break;

          const chunkContent = slice.join('\n');
          const tokens = tokenize(chunkContent);
          const termFreqs = computeTF(tokens);

          const uniqueTerms = new Set(tokens);
          for (const term of uniqueTerms) {
            this.docFreqs.set(term, (this.docFreqs.get(term) || 0) + 1);
          }

          let magnitude = 0;
          for (const v of termFreqs.values()) magnitude += v * v;
          magnitude = Math.sqrt(magnitude);

          this.chunks.push({
            file,
            startLine: i + 1,
            endLine: i + slice.length,
            content: chunkContent,
            termFreqs,
            magnitude,
          });
        }
      } catch {
        continue;
      }
    }

    this.totalDocs = this.chunks.length;
    this.indexed = true;
    return codeFiles.length;
  }

  search(query: string, topK = 8): CodeChunk[] {
    if (!this.indexed || this.chunks.length === 0) return [];

    const queryTokens = tokenize(query);
    const queryTF = computeTF(queryTokens);

    let queryMag = 0;
    for (const [term, tf] of queryTF) {
      const idf = Math.log(this.totalDocs / (1 + (this.docFreqs.get(term) || 0)));
      const w = tf * idf;
      queryTF.set(term, w);
      queryMag += w * w;
    }
    queryMag = Math.sqrt(queryMag);
    if (queryMag === 0) return [];

    const scored: Array<{ chunk: IndexedChunk; score: number }> = [];

    for (const chunk of this.chunks) {
      let dot = 0;
      for (const [term, qWeight] of queryTF) {
        const docTF = chunk.termFreqs.get(term) || 0;
        if (docTF === 0) continue;
        const idf = Math.log(this.totalDocs / (1 + (this.docFreqs.get(term) || 0)));
        dot += qWeight * docTF * idf;
      }
      if (dot === 0) continue;

      const score = dot / (queryMag * (chunk.magnitude || 1));
      scored.push({ chunk, score });
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map(s => ({
      file: s.chunk.file,
      startLine: s.chunk.startLine,
      endLine: s.chunk.endLine,
      content: s.chunk.content,
    }));
  }
}
