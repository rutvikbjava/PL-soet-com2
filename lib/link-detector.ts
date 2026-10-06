export function detectLinkType(url: string): {
  type: 'google_form' | 'google_drive' | 'external_url';
  label: string;
  buttonText: string;
  responsesUrl: string | null;
} {
  // Google Forms detection
  if (url.includes('forms.gle') || url.includes('docs.google.com/forms')) {
    return {
      type: 'google_form',
      label: 'Google Form',
      buttonText: 'Open Google Form',
      responsesUrl: null,
    };
  }

  // Google Drive detection
  if (url.includes('drive.google.com')) {
    return {
      type: 'google_drive',
      label: 'Google Drive',
      buttonText: 'Open Google Drive',
      responsesUrl: null,
    };
  }

  // External URL (default)
  return {
    type: 'external_url',
    label: 'External Link',
    buttonText: 'Open Submission Link',
    responsesUrl: null,
  };
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
