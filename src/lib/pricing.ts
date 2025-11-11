import { MICROCREDITS_PER_LKR } from './constants'

export function lkrToMicrocredits(lkr: number): number {
  return Math.ceil(lkr * MICROCREDITS_PER_LKR)
}

