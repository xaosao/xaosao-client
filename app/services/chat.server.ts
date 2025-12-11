import { prisma } from "./database.server";
import { FieldValidationError } from "./base.server";
import { ConversationStatus } from "~/interfaces/base";

export async function createConversation(customerId: string, modelId: string) {
  try {
    return await prisma.conversation.create({
      data: {
        customerId,
        modelId,
        status: ConversationStatus.ACTIVE,
      },
    });
  } catch (error: any) {
    console.log("CREATE_CONVERSATION_ERROR::", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message:
        error.message || "Failed to create conversation, Try again later!",
    });
  }
}

// get conversation by user id
export async function getUserConversation(customerId: string) {
  try {
    return await prisma.conversation.findMany({
      where: {
        customerId,
        status: "active",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        lastMessage: true,
        status: true,
        model: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: true,
          },
        },
        messages: {
          take: 1,
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            messageText: true,
            messageType: true,
            fileUrl: true,
            fileName: true,
            fileSize: true,
            isRead: true,
            isDeleted: true,
          },
        },
        _count: {
          select: {
            messages: {
              where: {
                isRead: false,
                isDeleted: false,
              },
            },
          },
        },
      },
    });
  } catch (error: any) {
    console.log("GET_USER_CONVERSATION_FAILED::", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to get user conversation!",
    });
  }
}

// get messages by conversation id
export async function getMessages(conversationId: string) {
  return await prisma.messages.findMany({
    where: {
      conversationId,
      isDeleted: false,
    },
    select: {
      id: true,
      sender: true,
      senderType: true,
      messageText: true,
      messageType: true,
      fileUrl: true,
      fileName: true,
      fileSize: true,
      isRead: true,
      isDeleted: true,
      replyToMessageId: true,
      sendAt: true,
      editedAt: true,
      createdAt: true,
    },
  });
}

// get model data by conversation id
export async function getModelByConversation(conversationId: string) {
  return await prisma.conversation.findFirst({
    where: {
      id: conversationId,
    },
    select: {
      id: true,
      model: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profile: true,
          status: true,
        },
      },
    },
  });
}
