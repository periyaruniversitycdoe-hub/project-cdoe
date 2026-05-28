export interface WelcomeEmailJobData {
  userId:   string;
  email:    string;
  fullName: string;
}

export interface VerificationEmailJobData {
  userId:        string;
  email:         string;
  fullName:      string;
  verifyLink:    string;
  expiresInHours: number;
}

export type MailJobData = WelcomeEmailJobData | VerificationEmailJobData;
