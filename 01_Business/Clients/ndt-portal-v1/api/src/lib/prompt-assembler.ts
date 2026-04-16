import fs from 'node:fs/promises';
import path from 'node:path';
import type { PartClassification } from './rt-validators';

const PROMPTS_DIR = path.resolve(__dirname, '../../prompts');

// In-memory cache — prompt files don't change between requests
const cache = new Map<string, string>();

async function readPrompt(relPath: string): Promise<string> {
  if (cache.has(relPath)) return cache.get(relPath)!;
  const abs = path.join(PROMPTS_DIR, relPath);
  const content = await fs.readFile(abs, 'utf-8');
  cache.set(relPath, content);
  return content;
}

const MODULE_FILES: Record<string, string> = {
  asme_viii_vessel:    'modules/asme_viii_vessel.txt',
  asme_b31_piping:     'modules/asme_b31_piping.txt',
  aws_structural:      'modules/aws_structural.txt',
  casting_radiography: 'modules/casting_radiography.txt',
  forging_inspection:  'modules/forging_inspection.txt',
  aerospace_ndt:       'modules/aerospace_ndt.txt',
  heat_exchanger:      'modules/heat_exchanger.txt',
  api_tank:            'modules/api_tank.txt',
  generic_rt:          'modules/generic_rt.txt',
};

export async function getStage1SystemPrompt(): Promise<string> {
  return readPrompt('stage1-classifier.txt');
}

export async function assembleStage2SystemPrompt(
  analysisModule: string,
  specContent?: string | null,
): Promise<string> {
  const base = await readPrompt('base-rt-analyst.txt');
  const moduleFile = MODULE_FILES[analysisModule] ?? MODULE_FILES['generic_rt'];
  const moduleContent = await readPrompt(moduleFile);
  const parts = [`${base}\n\n---\n\n${moduleContent}`];
  if (specContent) {
    parts.push(
      `---\n\nREFERENCE SPECIFICATION CLAUSES\n` +
      `The following normative clauses are extracted from the applicable code standard.\n` +
      `Use them as authoritative source for acceptance criteria, RT extent, and PWHT requirements.\n\n` +
      specContent,
    );
  }
  return parts.join('\n\n');
}

export interface DrawingData {
  rawText:          string;
  drawingNumber?:   string;
  revision?:        string;
  title?:           string;
  materialCallout?: string;
  codeStamp?:       string;
  notes?:           string;
  weldSymbols?:     unknown;
  dimensions?:      unknown;
}

export function buildStage1UserPrompt(drawing: DrawingData): string {
  return `Classify the following engineering drawing for RT inspection planning.

<drawing_data>
<raw_text>${drawing.rawText}</raw_text>
<title_block>
  <drawing_number>${drawing.drawingNumber ?? 'UNKNOWN'}</drawing_number>
  <revision>${drawing.revision ?? 'A'}</revision>
  <title>${drawing.title ?? ''}</title>
  <material_spec>${drawing.materialCallout ?? ''}</material_spec>
  <code_stamp>${drawing.codeStamp ?? ''}</code_stamp>
</title_block>
<notes>${drawing.notes ?? ''}</notes>
<weld_symbols>${JSON.stringify(drawing.weldSymbols ?? {})}</weld_symbols>
<dimensions>${JSON.stringify(drawing.dimensions ?? {})}</dimensions>
</drawing_data>

Respond with ONLY valid JSON matching the schema from your system prompt. No markdown, no preamble.`;
}

export function buildStage2UserPrompt(classification: PartClassification): string {
  return `Analyze this part for RT inspection planning.

<part_data>
${JSON.stringify(classification, null, 2)}
</part_data>

Generate the complete RT analysis with 3D render hints for every primitive.
Respond with ONLY valid JSON matching the universal schema from your system prompt. No markdown, no preamble.`;
}
