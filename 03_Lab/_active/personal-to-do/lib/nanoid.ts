import { nanoid as _nanoid } from 'nanoid'

export function nanoid(size = 21): string {
  return _nanoid(size)
}
