// Shapes the API sends back, shared with the website (type-only imports, no decorators here).

export type Role = 'customer' | 'barber' | 'owner';

/** The logged-in person, as GET /me returns them. */
export type Me = {
  id: string;
  email: string;
  fullName: string;
  /** Barber logins are barber-only: a barber never books as a customer. */
  role: Role;
  /** Has clicked the link in the verification email. */
  verified: boolean;
  /** A barber's record while the owner has them as active; null when deactivated, and for everyone else. */
  barberId: string | null;
};

/** POST /me/verification-email and friends: where the link went, or that one went out under a minute ago. */
export type LinkSent = { sentTo: string; tooSoon: boolean };

/** POST /email-verifications/:token */
export type VerifyResult = {
  result: 'verified' | 'expired' | 'missing';
  /** Guest bookings brought into the account. */
  added: number;
  /** The link belongs to whoever is logged in now. */
  sameUser: boolean;
};
