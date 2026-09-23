/**
 * Centralized Type & Schema Definitions for HAOne.
 */

/* ==========================================
 * Page & General Types
 * ========================================== */

export interface GoogleUserInfo {
  sub?: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email: string;
  email_verified?: boolean;
  hd?: string;
}

export interface GoogleAuthToken {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token: string;
}

export interface TokenExchangeResponse {
  tokenData: GoogleAuthToken;
  user: UserRecord;
  isInstanceAdmin: boolean;
  credentialJwt: string;
}

export interface CredentialPayload {
  email: string;
  sub: string;
  isInstanceAdmin: boolean;
  exp?: number;
}

export interface AuthExchangeResult {
  tokenData: {
    access_token: string;
    id_token: string;
  };
  user: UserRecord;
  isInstanceAdmin: boolean;
  credentialJwt: string;
  savedType: "admin" | "resident";
  target: string;
}

export interface ReceiptItem {
  name: string;
  amount: number;
}

export interface ReceiptData {
  dateIssued: string;
  paymentDate: string;
  processor: string;
  referenceNumber: string;
  period: string;
  seriesNumber: string;
  receivedFrom: string;
  receivedBy: string;
  notes: string;
  transactionType: string;
  branding: string;
  stno: string;
  items: ReceiptItem[];
}

export interface ClearanceData {
  name: string;
  stno: string;
  period: string;
  dateIssued: string;
  refNo: string;
  branding: string;
  signatory: string;
  signatoryTitle: string;
}

export interface FeaturedImageItem {
  id?: string;
  image: string;
  author: string;
  title: string;
  award?: string;
  description: string;
  camera?: string;
  cameraDetails?: string;
  voteLink?: string;
  hidden?: boolean;
}

export interface BrandingProfile {
  name: string;
  shortName: string;
  logoUrl: string;
  logoUrlDark: string;
  logoAlt: string;
  letterheadUrl: string;
  issuerName: string;
  emailHeaderUrl: string;
  googleClientId: string;
  replyTo: string;
  spreadsheetId: string;
  sectionRules?: string;
  regFormUrl?: string;
  paymentInstructionsUrl?: string;
  defaultReminders?: string;
  laundryRules?: string[];
  hero?: FeaturedImageItem[];
}

export interface EmailTemplate<T> {
  subject: (data: T, branding: BrandingProfile) => string;
  generateHtml: (data: T, branding: BrandingProfile) => string;
}

/* ==========================================
 * Google Sheets Definitive Column Indices
 * ========================================== */

export const JOURNAL_COL = {
  DATE: 0,
  CREATOR: 1, // EMAIL
  ACCOUNT: 2, // EMAIL
  WATER: 3,
  ASSOC: 4,
  MISC: 5,
  MOP: 6,
  PERIOD: 7,
  TYPE: 8,
  NOTES: 9,
  NOTES_PRIVATE: 10,
  MOP_REFNO: 11,
  PR_DATE_ISSUED: 12,
  PR_REFNO: 13,
  CREATOR_NAME: 14,
  NAME: 15, // ACCOUNT_NAME
  STNO: 16, // ST_NO
  WAS_AUDITED: 17,
  RECEIPT_URL: 18,
  ID: 19,
  CREATOR_ID: 20,
  ACCOUNT_ID: 21,
  MAINTENANCE: 22
} as const;

export const ACCOUNT_COL = {
  ID: 0,
  RESIDENT_ID: 1,
  PERIOD: 2,
  ROOM: 3,
  BED: 4,
  CE_REFNO: 5,
  CE_ISSUED: 6,
  CE_LINK: 7,
  NOTES: 8,
  ISSUER_ID: 9,
  CHECK_IN_DATE: 10,
  TYPE: 11
} as const;

export const USER_COL = {
  EMAIL: 0,
  LAST_NAME: 1,
  FIRST_NAME: 2,
  MIDDLE_NAME: 3,
  SUFFIX: 4,
  OVERRIDE_NAME: 5,
  DISPLAY_NAME: 6,
  DISPLAY_NAME_FL: 7,
  STUDENT_NO: 8,
  SECONDARY_CONTACT: 9,
  ADDRESS: 10,
  COLLEGE: 11,
  DEGREE_PROGRAM: 12,
  TAGS: 13,
  NOTES: 14,
  ID: 15
} as const;

export const CURR_COL = {
  TIMESTAMP: 0,
  EMAIL: 1,
  ROOM: 2,
  BED: 3,
  PROGRAM: 4,
  STUDENT_NO: 5,
  CHECK_IN_DATE: 6,
  LAST_NAME: 7,
  FIRST_NAME: 8,
  COLLEGE: 9,
  EVALUATED: 10,
  TERM: 11,
  ACCOUNT_TYPE: 12,
  SUFFIX: 13,
  OVERRIDE_NAME: 14,
  DECLINE_REASON: 15
} as const;

export const LAUNDRY_COL = {
  ID: 0,
  RESIDENT_ID: 1,
  DATE: 2,
  TIME_START: 3,
  TIME_END: 4,
  STATUS: 5,
  CANCEL_REASON: 6,
  CREATION_TIMESTAMP: 7,
  CANCEL_TIMESTAMP: 8
} as const;

export const PAYMENT_REQUEST_COL = {
  ID: 0,
  RESIDENT_ID: 1,
  DATE: 2,
  WATER_FEE: 3,
  ASSOC_FEE: 4,
  MISC: 5,
  MOP: 6,
  TYPE: 7,
  PROOF_LINK: 8,
  STATUS: 9,
  NOTES: 10,
  STATUS_REASON: 11,
  MAINTENANCE_FEE: 12
} as const;

export const ANNOUNCEMENT_COL = {
  ID: 0,
  CREATOR_ID: 1,
  DATE_CREATED: 2,
  START_DATE: 3,
  EXPIRY_DATE: 4,
  IS_INDEFINITE: 5,
  IS_ADMIN_ONLY: 6,
  TAGS: 7,
  TITLE: 8,
  CONTENT: 9,
  IS_UNLISTED: 10,
  SLUG: 11,
  BROADCAST_COUNT: 12
} as const;

export const ACHIEVEMENT_COL = {
  ID: 0,
  CREATOR_ID: 1,
  NAME: 2,
  DESCRIPTION: 3,
  ICON: 4,
  EXTRA_URL: 5,
  TERM: 6,
  POINTS: 7
} as const;

export const ACHIEVEMENT_RECORD_COL = {
  ID: 0,
  RECORDER_ID: 1,
  ACCOUNT_ID: 2,
  DATE: 3,
  ACHIEVEMENT_ID: 4,
  TERM: 5
} as const;

export const OFFICER_COL = {
  POSITION: 0,
  NAME: 1,
  NICKNAME: 2,
  EMAIL: 3,
  FB_LINK: 4,
  TERM: 5,
  COMMITTEE: 6,
  BIRTHDAY: 7,
  ID: 8,
  STATUS: 9
} as const;

export const USER_SETTINGS_COL = {
  RESIDENT_ID: 0,
  IS_PUBLIC_ACHIEVEMENT_LIST: 1,
  RESIDENT_NAV: 2,
  ADMIN_NAV: 3,
  DENSITY: 4,
  TYPOGRAPHY: 5,
  THEME: 6,
  IS_REDUCED_MOTION: 7,
  CLOCK_FORMAT: 8,
  CALENDAR_VIEW: 9
} as const;

export const CONSTANT_COL = {
  KEY: 0,
  VALUE: 1,
  DESCRIPTION: 2
} as const;

export const FRIDGE_ITEM_COL = {
  ID: 0,
  RESIDENT_ID: 1,
  NAME: 2,
  COMPARTMENT: 3,
  LOCATION_DETAILS: 4,
  DATE_STORED: 5,
  EXPIRY_DATE: 6,
  PHOTO_URL: 7,
  STATUS: 8,
  NOTES: 9,
  CHECK_OUT_DATE: 10,
  TAGS: 11,
  ACTION_BY: 12
} as const;

/* ==========================================
 * Data Record Interfaces
 * ========================================== */

export interface ResidentRecord {
  email: string;
  period: string;
  room: string;
  bed: string;
  name: string;
  stno: string;
  waterBase: number;
  waterPaid: number;
  waterWaived: number;
  waterBal: number;
  assocBase: number;
  assocPaid: number;
  assocWaived: number;
  assocBal: number;
  maintenanceBase?: number;
  maintenancePaid?: number;
  maintenanceWaived?: number;
  maintenanceBal?: number;
  totalBase: number;
  paid: number;
  waived: number;
  bal: number;
  isFullyPaid: boolean;
  notes: string;
  college: string;
  program: string;
  ceIssued: string;
  ceRefNo: string;
  ceLink: string;
  ceFullName: string;
  id: string;
  residentId: string;
  ledgerId: string;
  checkInDate: string;
  type: string;
  raw: string[];
}

export interface JournalRecord {
  date: string;
  creator: string; // EMAIL
  account: string; // EMAIL
  water: number;
  assoc: number;
  misc: number;
  maintenance?: number;
  amount: number;
  mop: string;
  period: string;
  type: string;
  notes: string;
  notesPrivate: string;
  mopRefNo: string;
  prDateIssued: string;
  prRefNo: string;
  creatorName: string;
  name: string; // ACCOUNT_NAME
  stno: string;
  wasAudited: boolean;
  receiptUrl: string;
  id: string;
  creatorId?: string;
  accountId?: string;
  raw: string[];
  dateWeight?: number;
  ledgerIndex?: number;
  runningBalance?: number;
  incoming?: number;
  outgoing?: number;
}

export interface UserRecord {
  email: string;
  lastName: string;
  firstName: string;
  middleName: string;
  suffix: string;
  overrideName: string;
  displayName: string;
  displayNameFormal: string;
  studentNo: string;
  secondaryContact: string;
  avatarUrl?: string;
  address?: string;
  college: string;
  program: string;
  tags?: string;
  notes?: string;
  id: string;
  raw?: string[];
}

export interface LaundryRecord {
  id: string;
  residentId: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  status: LaundryStatus | string;
  cancelReason: string;
  creationTimestamp?: string;
  cancelTimestamp?: string;
  displayName?: string;
  room?: string;
  raw: string[];
}

export interface PaymentRequestRecord {
  id: string;
  residentId: string;
  date: string;
  waterFee: number;
  assocFee: number;
  misc: number;
  maintenanceFee?: number;
  mop: string;
  type: string;
  proofLink: string;
  status: string;
  notes: string;
  statusReason?: string;
  raw: string[];
}

export interface AnnouncementRecord {
  id: string;
  creatorId: string;
  dateCreated: string;
  startDate: string;
  expiryDate: string;
  isIndefinite: boolean;
  isAdminOnly: boolean;
  isUnlisted: boolean;
  slug: string;
  creatorName?: string;
  tags: string;
  title: string;
  content: string;
  broadcastCount: number;
  raw: string[];
}

export interface OfficerRecord {
  position: string;
  name: string;
  nickname: string;
  email: string;
  fbLink: string;
  term: string;
  committee: string;
  birthday: string;
  id: string;
  status: OfficerStatus | string;
  raw: string[];
}

export interface AchievementRecord {
  id: string;
  creatorId: string;
  name: string;
  description: string;
  icon: string;
  extraUrl: string;
  term?: string;
  points: number;
  totalEligibleCount?: number;
  raw: string[];
}

export interface AchievementLogRecord {
  id: string;
  recorderId: string;
  accountId: string;
  date: string;
  achievementId: string;
  term?: string;
  displayName?: string;
  isPublic?: boolean;
  raw: string[];
}

export interface UserSettingsRecord {
  residentId: string;
  isPublicAchievementList: boolean;
  residentNav: string;
  adminNav: string;
  density: string;
  typography: string;
  theme: string;
  isReducedMotion: boolean;
  clockFormat: string;
  calendarView: "month" | "week" | "day" | "history";
  raw: string[];
}

export interface ConstantRecord {
  key: string;
  value: string;
  description: string;
  raw: string[];
}

export interface FridgeItemRecord {
  id: string;
  residentId: string;
  name: string;
  compartment: FridgeCompartment | string;
  locationDetails: string;
  dateStored: string;
  expiryDate?: string;
  photoUrl?: string;
  status: FridgeItemStatus | string;
  notes?: string;
  checkOutDate?: string;
  tags?: string[];
  actionBy?: string;
  // Joined / enriched display fields
  residentName?: string;
  actionByName?: string;
  room?: string;
  raw?: string[];
}

/* ==========================================
 * Enums & Associated Constants
 * ========================================== */

export enum UserTag {
  STUDENT = "STUDENT",
  BOOTCAMP = "BOOTCAMP",
  ALUMNUS = "ALUMNUS",
  FACULTY = "FACULTY",
  STAFF = "STAFF",
  REPS = "REPS",
  INTERNAL = "INTERNAL",
  DECEASED = "DECEASED",
  BACKED_OUT = "BACKED-OUT",
  RETURNING = "RETURNING",
  GUEST = "GUEST",
  TRANSFERRED_DORM = "TRANSFERRED_DORM",
  TRANSFERRED_OUTSIDE = "TRANSFERRED_OUTSIDE",
  UNKNOWN = "UNKNOWN"
}

export enum AccountType {
  STUDENT = "STUDENT",
  TRANSIENT = "TRANSIENT",
  BOOTCAMP = "BOOTCAMP",
  ALUMNUS = "ALUMNUS",
  FACULTY = "FACULTY",
  STAFF = "STAFF",
  REPS = "REPS"
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  [AccountType.STUDENT]: "Student (UP Mail required)",
  [AccountType.TRANSIENT]: "Transient without classification",
  [AccountType.BOOTCAMP]: "Bootcamp/Associate Degree Candidate",
  [AccountType.ALUMNUS]: "Former Resident/Alum",
  [AccountType.FACULTY]: "UHO Beneficiary: Faculty",
  [AccountType.STAFF]: "UHO Beneficiary: Staff",
  [AccountType.REPS]: "UHO Beneficiary: Research, Extension, and Professional Staff"
};

export const USER_TAG_LABELS: Record<string, string> = {
  [UserTag.STUDENT]: "Student",
  [UserTag.BOOTCAMP]: "Bootcamp/Associate Degree Candidate",
  [UserTag.ALUMNUS]: "Former Resident/Alum",
  [UserTag.FACULTY]: "UHO Beneficiary: Faculty",
  [UserTag.STAFF]: "UHO Beneficiary: Staff",
  [UserTag.REPS]: "UHO Beneficiary: Research, Extension, and Professional Staff",
  [UserTag.INTERNAL]: "Internal (Do Not Use)",
  [UserTag.DECEASED]: "Deceased",
  [UserTag.BACKED_OUT]: "Backed-out",
  [UserTag.RETURNING]: "Returning",
  [UserTag.GUEST]: "Guest",
  [UserTag.TRANSFERRED_DORM]: "Transferred to another UP residence hall",
  [UserTag.TRANSFERRED_OUTSIDE]: "Transferred to an outside housing facility",
  [UserTag.UNKNOWN]: "Unknown"
};

export const USER_TAG_COLORS: Record<string, string> = {
  [UserTag.STUDENT]: "bg-emerald-100 text-emerald-700 border-emerald-200",
  [UserTag.BOOTCAMP]: "bg-emerald-100 text-emerald-700 border-emerald-200",
  [UserTag.ALUMNUS]: "bg-blue-100 text-blue-700 border-blue-200",
  [UserTag.FACULTY]: "bg-purple-100 text-purple-700 border-purple-200",
  [UserTag.STAFF]: "bg-purple-100 text-purple-700 border-purple-200",
  [UserTag.REPS]: "bg-purple-100 text-purple-700 border-purple-200",
  [UserTag.INTERNAL]: "bg-amber-100 text-amber-700 border-amber-200",
  [UserTag.DECEASED]: "bg-red-100 text-red-700 border-red-200",
  [UserTag.BACKED_OUT]: "bg-red-100 text-red-700 border-red-200",
  [UserTag.RETURNING]: "bg-cyan-100 text-cyan-700 border-cyan-200",
  [UserTag.GUEST]: "bg-slate-100 text-slate-700 border-slate-200",
  [UserTag.TRANSFERRED_DORM]: "bg-orange-100 text-orange-700 border-orange-200",
  [UserTag.TRANSFERRED_OUTSIDE]: "bg-orange-100 text-orange-700 border-orange-200",
  [UserTag.UNKNOWN]: "bg-stone-100 text-stone-700 border-stone-200",
  DEFAULT: "bg-muted text-muted-foreground border-border"
};

export enum TransactionType {
  COLLECTION = "COLLECTION",
  COLLECTION_OTHERS = "COLLECTION_OTHERS",
  CARRYOVER = "CARRYOVER",
  FUND_TRANSFER = "FUND_TRANSFER",
  TRANSFER_FROM = "TRANSFER_FROM",
  TRANSFER_TO = "TRANSFER_TO",
  DISCREPANCY = "DISCREPANCY",
  REFUND = "REFUND",
  REFUND_COLLECTION = "COLLECTION_REFUND",
  RECLASSIFY = "RECLASSIFY",
  PURCHASE = "PURCHASE",
  WATER = "WATER",
  WATER_AA = "WATER_AQUA_ALTRIA",
  TRANSACTION_FEE = "TRANSACTION_FEE",
  UPLB_ADA_FEE = "UPLB_ADA_FEE",
  TRANSPORTATION = "TRANSPORTATION",
  EOS = "EOS",
  EOS_UNSETTLED = "EOS_UNSETTLED",
  WAIVED = "WAIVED",
  NOTE_MARKER = "NOTE_MARKER",
  TYPE_RESERVED = "TYPE_RESERVED"
}

export interface TransactionTypeMetadata {
  key: TransactionType;
  value: string;
  label: string;
}

export const TRANSACTION_TYPE_CONFIG: Record<TransactionType, { val: string; label: string }> = {
  [TransactionType.COLLECTION]: { val: "COLLECTION", label: "Collection" },
  [TransactionType.COLLECTION_OTHERS]: { val: "COLLECTION_OTHERS", label: "Collection (Others)" },
  [TransactionType.CARRYOVER]: { val: "CARRYOVER", label: "Carryover" },
  [TransactionType.FUND_TRANSFER]: { val: "FUND_TRANSFER", label: "Fund Transfer" },
  [TransactionType.TRANSFER_FROM]: { val: "TRANSFER_FROM", label: "Transfer From" },
  [TransactionType.TRANSFER_TO]: { val: "TRANSFER_TO", label: "Transfer To" },
  [TransactionType.DISCREPANCY]: { val: "DISCREPANCY", label: "Discrepancy" },
  [TransactionType.REFUND]: { val: "REFUND", label: "Refund (General)" },
  [TransactionType.REFUND_COLLECTION]: { val: "COLLECTION_REFUND", label: "Refund (Collection)" },
  [TransactionType.RECLASSIFY]: { val: "RECLASSIFY", label: "Reclassify" },
  [TransactionType.PURCHASE]: { val: "PURCHASE", label: "Purchase" },
  [TransactionType.WATER_AA]: { val: "WATER_AQUA_ALTRIA", label: "Purchase: Water (Aqua Altria)" },
  [TransactionType.WATER]: { val: "WATER", label: "Purchase: Water" },
  [TransactionType.TRANSACTION_FEE]: { val: "TRANSACTION_FEE", label: "Transaction Fees" },
  [TransactionType.UPLB_ADA_FEE]: { val: "UPLB_ADA_FEE", label: "UPLB ADA Fees" },
  [TransactionType.TRANSPORTATION]: { val: "TRANSPORTATION", label: "Transportation Fees" },
  [TransactionType.EOS]: { val: "EOS", label: "End of Term" },
  [TransactionType.EOS_UNSETTLED]: { val: "EOS_UNSETTLED", label: "End of Term (Unsettled)" },
  [TransactionType.WAIVED]: { val: "WAIVED", label: "Waived" },
  [TransactionType.NOTE_MARKER]: { val: "NOTE_MARKER", label: "Note Marker" },
  [TransactionType.TYPE_RESERVED]: { val: "DO_NOT_USE", label: "Reserved (Hidden)" }
};

export const TRANSACTION_TYPE_OPTIONS: TransactionTypeMetadata[] = (
  Object.keys(TRANSACTION_TYPE_CONFIG) as TransactionType[]
)
  .filter((k) => k !== TransactionType.TYPE_RESERVED && k !== TransactionType.NOTE_MARKER)
  .map((key) => ({
    key,
    value: TRANSACTION_TYPE_CONFIG[key].val,
    label: TRANSACTION_TYPE_CONFIG[key].label
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

export const TRANSACTION_TYPE_FUNDS_ONLY: TransactionType[] = [
  TransactionType.CARRYOVER,
  TransactionType.DISCREPANCY,
  TransactionType.EOS,
  TransactionType.EOS_UNSETTLED,
  TransactionType.PURCHASE,
  TransactionType.REFUND,
  TransactionType.TRANSPORTATION,
  TransactionType.UPLB_ADA_FEE,
  TransactionType.WATER_AA,
  TransactionType.WATER
];

export const TRANSACTION_TYPE_WITH_RECEIPT: TransactionType[] = [
  TransactionType.WAIVED,
  TransactionType.COLLECTION
];

export const TRANSACTION_TYPE_MAYBE_WITH_RECEIPT: TransactionType[] = [
  TransactionType.RECLASSIFY,
  TransactionType.COLLECTION_OTHERS,
  TransactionType.TRANSFER_TO,
  TransactionType.TRANSFER_FROM,
  TransactionType.REFUND_COLLECTION,
  TransactionType.REFUND
];

export enum PaymentRequestStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  DECLINED = "DECLINED",
  CANCELLED = "CANCELLED"
}

export const PAYMENT_REQUEST_STATUS_COLORS: Record<string, string> = {
  [PaymentRequestStatus.PENDING]: "bg-amber-100 text-amber-700 border-amber-200",
  [PaymentRequestStatus.APPROVED]: "bg-emerald-100 text-emerald-700 border-emerald-200",
  [PaymentRequestStatus.DECLINED]: "bg-rose-100 text-rose-700 border-rose-200",
  [PaymentRequestStatus.CANCELLED]: "bg-slate-100 text-slate-700 border-slate-200",
  DEFAULT: "bg-muted text-muted-foreground border-border"
};

export enum OfficerStatus {
  ACTIVE = "ACTIVE",
  RESIGNED = "RESIGNED",
  CHANGED_POSITION = "CHANGED_POSITION"
}

export enum LaundryStatus {
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  CANCELLED_BY_ADMIN = "CANCELLED_BY_ADMIN",
  CANCELLED_BY_USER = "CANCELLED_BY_USER"
}

export enum AnnouncementStatus {
  ACTIVE = "ACTIVE",
  FUTURE = "FUTURE",
  EXPIRED = "EXPIRED"
}

export const ANNOUNCEMENT_STATUS_COLORS: Record<string, string> = {
  [AnnouncementStatus.ACTIVE]: "bg-emerald-100 text-emerald-700 border-emerald-200",
  [AnnouncementStatus.FUTURE]: "bg-blue-100 text-blue-700 border-blue-200",
  [AnnouncementStatus.EXPIRED]: "bg-slate-100 text-slate-700 border-slate-200",
  DEFAULT: "bg-muted text-muted-foreground border-border"
};

export enum AnnouncementTag {
  IMPORTANT = "IMPORTANT",
  MAINTENANCE = "MAINTENANCE",
  EVENT = "EVENT",
  BILLING = "BILLING",
  SECURITY = "SECURITY",
  NEWS = "NEWS",
  REGISTRATION = "REGISTRATION",
  CLEANING = "CLEANING"
}

export const ANNOUNCEMENT_TAG_LIST = Object.values(AnnouncementTag);

export const ANNOUNCEMENT_TAG_COLORS: Record<string, string> = {
  [AnnouncementTag.IMPORTANT]: "bg-red-100 text-red-700 border-red-200",
  [AnnouncementTag.MAINTENANCE]: "bg-amber-100 text-amber-700 border-amber-200",
  [AnnouncementTag.EVENT]: "bg-purple-100 text-purple-700 border-purple-200",
  [AnnouncementTag.BILLING]: "bg-blue-100 text-blue-700 border-blue-200",
  [AnnouncementTag.SECURITY]: "bg-rose-100 text-rose-700 border-rose-200",
  [AnnouncementTag.NEWS]: "bg-emerald-100 text-emerald-700 border-emerald-200",
  [AnnouncementTag.REGISTRATION]: "bg-cyan-100 text-cyan-700 border-cyan-200",
  [AnnouncementTag.CLEANING]: "bg-slate-100 text-slate-700 border-slate-200",
  DEFAULT: "bg-muted text-muted-foreground border-border"
};

export enum FridgeTag {
  PRIVATE = "PRIVATE",
  FOR_SHARING = "FOR_SHARING",
  HALAL = "HALAL",
  VEGETARIAN = "VEGETARIAN",
  VEGAN = "VEGAN",
  DAIRY_FREE = "DAIRY_FREE",
  GLUTEN_FREE = "GLUTEN_FREE",
  CONTAINS_NUTS = "CONTAINS_NUTS",
  CONTAINS_SEAFOOD = "CONTAINS_SEAFOOD",
  CONTAINS_PORK = "CONTAINS_PORK",
  LEFTOVER = "LEFTOVER",
  MEAL_PREP = "MEAL_PREP",
  SNACK = "SNACK",
  DESSERT = "DESSERT",
  BAKERY = "BAKERY",
  CONDIMENT = "CONDIMENT",
  BEVERAGE = "BEVERAGE",
  DAIRY_MILK = "DAIRY_MILK",
  PRODUCE_FRUIT = "PRODUCE_FRUIT",
  PRODUCE_VEGGIE = "PRODUCE_VEGGIE",
  MEAT_POULTRY = "MEAT_POULTRY",
  SEAFOOD = "SEAFOOD",
  FROZEN_MEAL = "FROZEN_MEAL",
  ICE_CREAM = "ICE_CREAM",
  MEDICINE = "MEDICINE",
  EXPIRING_SOON = "EXPIRING_SOON"
}

export const FRIDGE_TAG_LABELS: Record<string, string> = {
  [FridgeTag.PRIVATE]: "Private/Do Not Touch",
  [FridgeTag.FOR_SHARING]: "For Sharing/Free to Eat",
  [FridgeTag.HALAL]: "Halal",
  [FridgeTag.VEGETARIAN]: "Vegetarian",
  [FridgeTag.VEGAN]: "Vegan",
  [FridgeTag.DAIRY_FREE]: "Dairy-Free",
  [FridgeTag.GLUTEN_FREE]: "Gluten-Free",
  [FridgeTag.CONTAINS_NUTS]: "Contains Nuts",
  [FridgeTag.CONTAINS_SEAFOOD]: "Contains Seafood",
  [FridgeTag.CONTAINS_PORK]: "Contains Pork",
  [FridgeTag.LEFTOVER]: "Leftovers",
  [FridgeTag.MEAL_PREP]: "Meal Prep",
  [FridgeTag.SNACK]: "Snacks/Finger Food",
  [FridgeTag.DESSERT]: "Dessert/Sweet",
  [FridgeTag.BAKERY]: "Bakery/Bread",
  [FridgeTag.CONDIMENT]: "Condiment/Sauce/Spread",
  [FridgeTag.BEVERAGE]: "Beverage/Drink",
  [FridgeTag.DAIRY_MILK]: "Milk/Dairy/Cheese",
  [FridgeTag.PRODUCE_FRUIT]: "Fresh Fruit",
  [FridgeTag.PRODUCE_VEGGIE]: "Vegetables/Salad",
  [FridgeTag.MEAT_POULTRY]: "Meat/Poultry",
  [FridgeTag.SEAFOOD]: "Seafood/Fish",
  [FridgeTag.FROZEN_MEAL]: "Frozen Meal",
  [FridgeTag.ICE_CREAM]: "Ice Cream/Popsicle",
  [FridgeTag.MEDICINE]: "Medicine/Insulin",
  [FridgeTag.EXPIRING_SOON]: "Expiring Soon"
};

export const FRIDGE_TAG_COLORS: Record<string, string> = {
  [FridgeTag.PRIVATE]: "bg-rose-100 text-rose-700 border-rose-200",
  [FridgeTag.FOR_SHARING]: "bg-emerald-100 text-emerald-700 border-emerald-200",
  [FridgeTag.HALAL]: "bg-teal-100 text-teal-700 border-teal-200",
  [FridgeTag.VEGETARIAN]: "bg-green-100 text-green-700 border-green-200",
  [FridgeTag.VEGAN]: "bg-emerald-100 text-emerald-800 border-emerald-300",
  [FridgeTag.DAIRY_FREE]: "bg-sky-100 text-sky-700 border-sky-200",
  [FridgeTag.GLUTEN_FREE]: "bg-amber-100 text-amber-800 border-amber-300",
  [FridgeTag.CONTAINS_NUTS]: "bg-orange-100 text-orange-800 border-orange-200",
  [FridgeTag.CONTAINS_SEAFOOD]: "bg-cyan-100 text-cyan-800 border-cyan-200",
  [FridgeTag.CONTAINS_PORK]: "bg-pink-100 text-pink-700 border-pink-200",
  [FridgeTag.LEFTOVER]: "bg-amber-100 text-amber-700 border-amber-200",
  [FridgeTag.MEAL_PREP]: "bg-indigo-100 text-indigo-700 border-indigo-200",
  [FridgeTag.SNACK]: "bg-yellow-100 text-yellow-800 border-yellow-200",
  [FridgeTag.DESSERT]: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  [FridgeTag.BAKERY]: "bg-amber-100 text-amber-700 border-amber-200",
  [FridgeTag.CONDIMENT]: "bg-purple-100 text-purple-700 border-purple-200",
  [FridgeTag.BEVERAGE]: "bg-blue-100 text-blue-700 border-blue-200",
  [FridgeTag.DAIRY_MILK]: "bg-blue-100 text-blue-800 border-blue-200",
  [FridgeTag.PRODUCE_FRUIT]: "bg-lime-100 text-lime-800 border-lime-200",
  [FridgeTag.PRODUCE_VEGGIE]: "bg-emerald-100 text-emerald-700 border-emerald-200",
  [FridgeTag.MEAT_POULTRY]: "bg-red-100 text-red-700 border-red-200",
  [FridgeTag.SEAFOOD]: "bg-cyan-100 text-cyan-700 border-cyan-200",
  [FridgeTag.FROZEN_MEAL]: "bg-sky-100 text-sky-800 border-sky-300",
  [FridgeTag.ICE_CREAM]: "bg-pink-100 text-pink-700 border-pink-200",
  [FridgeTag.MEDICINE]: "bg-violet-100 text-violet-700 border-violet-200",
  [FridgeTag.EXPIRING_SOON]: "bg-orange-100 text-orange-700 border-orange-200",
  DEFAULT: "bg-muted text-muted-foreground border-border"
};

export const FRIDGE_TAG_LIST = Object.values(FridgeTag);

export enum FridgeCompartment {
  FREEZER = "FREEZER",
  REFRIGERATOR = "REFRIGERATOR"
}

export const FRIDGE_COMPARTMENT_LABELS: Record<string, string> = {
  [FridgeCompartment.FREEZER]: "Freezer",
  [FridgeCompartment.REFRIGERATOR]: "Refrigerator (Lower)"
};

export enum FridgeItemStatus {
  STORED = "STORED",
  CHECKED_OUT = "CHECKED_OUT",
  CHECKED_OUT_HISTORY = "CHECKED_OUT_HISTORY",
  DISCARDED = "DISCARDED"
}

export const FRIDGE_ITEM_STATUS_COLORS: Record<string, string> = {
  [FridgeItemStatus.STORED]: "bg-emerald-100 text-emerald-700 border-emerald-200",
  [FridgeItemStatus.CHECKED_OUT]: "bg-slate-100 text-slate-700 border-slate-200",
  [FridgeItemStatus.CHECKED_OUT_HISTORY]: "bg-zinc-100 text-zinc-500 border-zinc-200",
  [FridgeItemStatus.DISCARDED]: "bg-rose-100 text-rose-700 border-rose-200",
  DEFAULT: "bg-muted text-muted-foreground border-border"
};

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, any>;
  bypassCache?: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CustomServiceItem {
  title: string;
  url: string;
  icon: any;
  description?: string;
  target: "admin" | "resident";
  isAllowed?: (accountType: string, room?: string) => boolean;
}

export enum FeatureFlagKey {
  LAUNDRY_SERVICE = "services.laundry",
  FRIDGE_SERVICE = "services.fridge",

  ONBOARDING_ACCTYPE_UHO = "onboarding.accountType.uho",
  ONBOARDING_ACCTYPE_ALUMNI = "onboarding.accountType.alumni"
}
