export const CHANGE_TYPE_LABELS: Record<string, string> = {
  profile: 'Gym profile',
  image_add: 'Photo upload',
  image_delete: 'Photo removal',
  doc_add: 'Document upload',
  doc_delete: 'Document removal',
  slot_prices: 'Slot pricing',
  slot_block_add: 'Slot block',
  slot_block_delete: 'Slot block removal',
  operating_hours_update: 'Operating hours',
  class_add: 'Class added',
  class_update: 'Class change',
  class_delete: 'Class removal',
};

// 0=Sunday..6=Saturday — matches GymOperatingHours/GymClass.dayOfWeek in gym-service.
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
