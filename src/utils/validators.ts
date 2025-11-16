import { Vessel } from '../data/types';
import { LAST_BOARD_INDEX, MAX_VESSEL_SIZE } from '../data/constants';
import { isValidCoordinate } from './helpers';

export const validateVesselPlacement = (vessel: Vessel): boolean => {
  const { position, direction, length } = vessel;
  const { y, x } = position;

  const isSizeValid = length > 0 && length <= MAX_VESSEL_SIZE;
  if (!isValidCoordinate(x, y) || !isSizeValid) {
    return false;
  }

  const lastVesselCell = direction ? y + length - 1 : x + length - 1;
  return lastVesselCell <= LAST_BOARD_INDEX;
};