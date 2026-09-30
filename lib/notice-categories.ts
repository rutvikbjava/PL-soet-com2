export const NOTICE_CATEGORIES = [
  'Academic',
  'Examination',
  'Administrative',
  'Event',
  'Holiday',
  'Circular',
  'Urgent',
  'General'
] as const

export const RECIPIENT_ROLES = [
  { value: 'faculty',   label: 'All Faculty' },
  { value: 'hod',       label: 'All HODs' },
  { value: 'coe',       label: 'COE' },
  { value: 'principal', label: 'Principal' },
  { value: 'student',   label: 'All Students' },
] as const

export const DEPARTMENTS = [
  'Computer Science',
  'Mechanical Engineering',
  'Civil Engineering',
  'Electronics & Telecommunication',
  'Information Technology',
  'MBA',
  'MCA',
  'All Departments',
] as const
