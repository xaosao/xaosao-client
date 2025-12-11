export enum Gender {
  MALE = "male",
  FEMALE = "female",
  OTHER = "other",
}

export enum UserStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  SUSPENDED = "suspended",
}

export enum ConversationStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  BLOCKED = "blocked",
}

export enum IAvailableStatus {
  ONLINE = "online",
  OFFLINE = "offline",
  BUSY = "busy",
  AWAY = "away",
}

export interface IUserImages {
  id: string;
  name: string;
}

export enum InteractionAction {
  LIKE = "LIKE",
  PASS = "PASS",
}

export enum BookingStatus {
  pending = "pending",
  confirmed = "confirmed",
  completed = "completed",
  cancelled = "cancelled",
  rejected = "rejected",
  awaiting_confirmation = "awaiting_confirmation",
}
