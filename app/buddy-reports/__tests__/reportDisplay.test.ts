import { describe, it, expect } from 'vitest';
import {
  REPORT_STATUSES,
  REPORT_STATUS_LABELS,
  REPORT_REASON_LABELS,
  HIGH_SEVERITY_REASONS,
  isHighSeverity,
  photoUrl,
  reportPartLabel,
  reportReasonLabel,
  reportSeverity,
} from '../reportDisplay';

describe('REPORT_STATUSES', () => {
  it('lists the three queue tabs in display order', () => {
    expect(REPORT_STATUSES).toEqual(['open', 'actioned', 'dismissed']);
  });

  it('has a label for every status', () => {
    for (const status of REPORT_STATUSES) {
      expect(REPORT_STATUS_LABELS[status]).toBeTruthy();
    }
  });
});

describe('reportReasonLabel', () => {
  it('maps every report reason to its product label', () => {
    expect(reportReasonLabel('harassment')).toBe('Harassment');
    expect(reportReasonLabel('threat')).toBe('Threatening me');
    expect(reportReasonLabel('underage')).toBe('Seems under 18');
    expect(reportReasonLabel('impersonation')).toBe('Fake profile');
    expect(reportReasonLabel('inappropriate_content')).toBe('Inappropriate content');
    expect(reportReasonLabel('scam')).toBe('Spam or scam');
    expect(reportReasonLabel('other')).toBe('Something else');
  });

  it('sends both spam and scam to the one shipped label', () => {
    expect(reportReasonLabel('spam')).toBe('Spam or scam');
    expect(reportReasonLabel('scam')).toBe('Spam or scam');
  });

  it('falls back to the raw reason for an unknown enum value', () => {
    expect(reportReasonLabel('some_future_reason')).toBe('some_future_reason');
  });

  it('returns Unknown for a missing reason', () => {
    expect(reportReasonLabel(null)).toBe('Unknown');
    expect(reportReasonLabel(undefined)).toBe('Unknown');
    expect(reportReasonLabel('')).toBe('Unknown');
  });

  it('covers every entry in REPORT_REASON_LABELS', () => {
    for (const reason of Object.keys(REPORT_REASON_LABELS)) {
      expect(reportReasonLabel(reason)).toBe(REPORT_REASON_LABELS[reason]);
    }
  });
});

describe('reportSeverity', () => {
  it('trusts an explicit high severity from the server', () => {
    expect(reportSeverity({ reason: 'harassment', severity: 'high' })).toBe('high');
  });

  it('trusts an explicit normal severity even for a threat', () => {
    expect(reportSeverity({ reason: 'threat', severity: 'normal' })).toBe('normal');
  });

  it('falls back to the reason when the server omits severity', () => {
    expect(reportSeverity({ reason: 'threat' })).toBe('high');
    expect(reportSeverity({ reason: 'underage' })).toBe('high');
    expect(reportSeverity({ reason: 'harassment' })).toBe('normal');
  });

  it('treats an unknown or missing reason as normal', () => {
    expect(reportSeverity({ reason: null })).toBe('normal');
    expect(reportSeverity({ reason: 'some_future_reason' })).toBe('normal');
  });

  it('isHighSeverity mirrors reportSeverity', () => {
    expect(isHighSeverity({ reason: 'threat' })).toBe(true);
    expect(isHighSeverity({ reason: 'spam' })).toBe(false);
  });

  it('HIGH_SEVERITY_REASONS holds exactly threat and underage', () => {
    expect([...HIGH_SEVERITY_REASONS].sort()).toEqual(['threat', 'underage']);
  });
});

describe('photoUrl', () => {
  it('passes through a bare URL string', () => {
    expect(photoUrl('https://cdn.test/a.jpg')).toBe('https://cdn.test/a.jpg');
  });

  it('reads url from a photo object', () => {
    expect(photoUrl({ url: 'https://cdn.test/b.jpg' })).toBe('https://cdn.test/b.jpg');
  });

  it('returns null for a blank string or a missing url', () => {
    expect(photoUrl('')).toBeNull();
    expect(photoUrl({})).toBeNull();
    expect(photoUrl({ url: null })).toBeNull();
  });
});

describe('reportPartLabel', () => {
  it('shows the name when present', () => {
    expect(reportPartLabel({ userId: 5, name: 'Asha' })).toBe('Asha');
  });

  it('falls back to the id when there is no name', () => {
    expect(reportPartLabel({ userId: 5, name: null })).toBe('#5');
  });

  it('marks an erased account', () => {
    expect(reportPartLabel({ userId: null, name: null, erased: true })).toBe('Account deleted');
  });

  it('returns Unknown when there is neither a name nor an id', () => {
    expect(reportPartLabel({ userId: null, name: null })).toBe('Unknown');
  });
});
