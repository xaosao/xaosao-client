import type { ConversationStatus } from "./base";

export interface IConversationModel {
  id: string;
  firstName: string;
  lastName: string;
  profile: string;
}

export interface IConversationMessage {
  id: string;
  messageText: string;
  messageType: string;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: string | null;
  isRead: boolean;
  isDeleted: boolean;
  createdAt: Date;
}

export interface IConversationResponse {
  id: string;
  lastMessage: Date;
  status: ConversationStatus;
  model: IConversationModel;
  messages?: IConversationMessage[];
  _count: {
    messages: number;
  };
}

export interface IMessagesResponse {
  id: string;
  sender: string;
  senderType: string;
  messageText: string;
  messageType: string;
  fileUrl: string;
  fileName: string;
  fileSize: string;
  isRead: boolean;
  isDeleted: boolean;
  replyToMessageId: string;
  sendAt: Date;
  editedAt: Date;
  createdAt: Date;
}
