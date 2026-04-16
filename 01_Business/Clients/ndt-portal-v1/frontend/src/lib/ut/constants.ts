import type { GeometryType } from './types';

export interface GeometryDef {
  id: GeometryType;
  label: string;
  icon: string;
  fields: ('thickness' | 'width' | 'length' | 'diameter' | 'od' | 'id_' | 'numScans')[];
}

export const GEOMETRY_DEFS: GeometryDef[] = [
  { id: 'FLAT_BAR',    label: 'Flat Bar / Plate',     icon: '▬',   fields: ['thickness', 'width', 'length'] },
  { id: 'ROUND_BAR',   label: 'Round Bar',            icon: '●',   fields: ['diameter', 'length'] },
  { id: 'RING',        label: 'Ring',                  icon: '◎',   fields: ['od', 'id_', 'length'] },
  { id: 'TUBING',      label: 'Tubing',                icon: '◯',   fields: ['diameter', 'length', 'numScans'] },
  { id: 'CSCAN_FLAT',  label: 'C-Scan Flat',          icon: '▬',   fields: ['thickness', 'width', 'length'] },
  { id: 'CSCAN_ROUND', label: 'C-Scan Round',         icon: '●',   fields: ['diameter', 'length'] },
  { id: 'THIN_SHEET',  label: 'Thin Sheet (2-sided)', icon: '▬▬',  fields: ['thickness', 'width', 'length'] },
];

export const FIELD_LABELS: Record<string, string> = {
  thickness: 'Thickness (in)',
  width: 'Width (in)',
  length: 'Length (in)',
  diameter: 'Diameter (in)',
  od: 'OD (in)',
  id_: 'ID (in)',
  numScans: '# of Scans',
};

export const WEIGHT_ELIGIBLE: GeometryType[] = ['FLAT_BAR', 'CSCAN_FLAT', 'ROUND_BAR', 'CSCAN_ROUND'];
