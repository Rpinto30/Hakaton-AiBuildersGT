import type { MapUiState } from './mapStore'

export function hasActiveSelection(state: MapUiState): boolean {
  return state.selected !== null
}

export function isDepartmentHovered(
  state: MapUiState,
  nombre: string,
): boolean {
  return state.hovered === nombre
}

export function isDepartmentSelected(
  state: MapUiState,
  nombre: string,
): boolean {
  return state.selected === nombre
}
