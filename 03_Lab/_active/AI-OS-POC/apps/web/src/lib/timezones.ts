export interface TzOption {
  value: string
  label: string
}

export const TIMEZONES: TzOption[] = [
  // Americas
  { value: "America/Los_Angeles",  label: "Pacific Time (US)" },
  { value: "America/Phoenix",      label: "Mountain Time — Arizona" },
  { value: "America/Denver",       label: "Mountain Time (US)" },
  { value: "America/Chicago",      label: "Central Time (US)" },
  { value: "America/New_York",     label: "Eastern Time (US)" },
  { value: "America/Halifax",      label: "Atlantic Time (Canada)" },
  { value: "America/Anchorage",    label: "Alaska Time" },
  { value: "America/Vancouver",    label: "Pacific Time (Canada)" },
  { value: "America/Toronto",      label: "Eastern Time (Canada)" },
  { value: "America/Mexico_City",  label: "Central Time (Mexico)" },
  { value: "America/Bogota",       label: "Colombia Time" },
  { value: "America/Lima",         label: "Peru Time" },
  { value: "America/Santiago",     label: "Chile Time" },
  { value: "America/Sao_Paulo",    label: "Brazil Time" },
  { value: "America/Buenos_Aires", label: "Argentina Time" },
  // Europe
  { value: "Europe/London",        label: "London (GMT/BST)" },
  { value: "Europe/Dublin",        label: "Dublin (IST)" },
  { value: "Europe/Lisbon",        label: "Lisbon (WET/WEST)" },
  { value: "Europe/Paris",         label: "Paris / Central Europe" },
  { value: "Europe/Berlin",        label: "Berlin / Central Europe" },
  { value: "Europe/Madrid",        label: "Madrid" },
  { value: "Europe/Rome",          label: "Rome" },
  { value: "Europe/Amsterdam",     label: "Amsterdam" },
  { value: "Europe/Brussels",      label: "Brussels" },
  { value: "Europe/Vienna",        label: "Vienna" },
  { value: "Europe/Zurich",        label: "Zurich" },
  { value: "Europe/Stockholm",     label: "Stockholm" },
  { value: "Europe/Oslo",          label: "Oslo" },
  { value: "Europe/Copenhagen",    label: "Copenhagen" },
  { value: "Europe/Helsinki",      label: "Helsinki" },
  { value: "Europe/Warsaw",        label: "Warsaw" },
  { value: "Europe/Prague",        label: "Prague" },
  { value: "Europe/Budapest",      label: "Budapest" },
  { value: "Europe/Bucharest",     label: "Bucharest" },
  { value: "Europe/Athens",        label: "Athens" },
  { value: "Europe/Istanbul",      label: "Istanbul" },
  { value: "Europe/Moscow",        label: "Moscow" },
]
