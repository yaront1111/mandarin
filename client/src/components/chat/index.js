// src/components/chat/index.js
import AttachmentPreview from './AttachmentPreview';
import CallBanners from './CallBanners';
import ChatArea from './ChatArea';
import ChatHeader from './ChatHeader';
import ChatInput from './ChatInput';
import { 
  LoadingIndicator, 
  ErrorMessage, 
  ConnectionIssueMessage, 
  NoMessagesPlaceholder 
} from './ChatStatusIndicators';
import ConversationItem from './ConversationItem';
import ConversationList from './ConversationList';
import EmojiPicker from './EmojiPicker';
import FileAttachmentHandler from './FileAttachmentHandler';
import MessageItem from './MessageItem';
import MessageList from './MessageList';
import PremiumBanner from './PremiumBanner';
import TypingIndicator from './TypingIndicator';

// Utils
import { 
  groupMessagesByDate,
  formatMessagePreview,
  formatMessageTime,
  formatMessageDateSeparator,
  formatPreviewTime,
  classNames,
  getFileIcon,
  generateLocalUniqueId
} from './chatUtils';

// Constants
import { ACCOUNT_TIER, COMMON_EMOJIS } from './chatConstants';

export {
  // Components
  AttachmentPreview,
  CallBanners,
  ChatArea,
  ChatHeader,
  ChatInput,
  LoadingIndicator,
  ErrorMessage,
  ConnectionIssueMessage,
  NoMessagesPlaceholder,
  ConversationItem,
  ConversationList,
  EmojiPicker,
  FileAttachmentHandler,
  MessageItem,
  MessageList,
  PremiumBanner,
  TypingIndicator,

  // Utils
  groupMessagesByDate,
  formatMessagePreview,
  formatMessageTime,
  formatMessageDateSeparator,
  formatPreviewTime,
  classNames,
  getFileIcon,
  generateLocalUniqueId,

  // Constants
  ACCOUNT_TIER,
  COMMON_EMOJIS
};

// Default export for convenience
export default {
  AttachmentPreview,
  CallBanners,
  ChatArea,
  ChatHeader,
  ChatInput,
  ChatStatusIndicators: {
    LoadingIndicator,
    ErrorMessage,
    ConnectionIssueMessage,
    NoMessagesPlaceholder
  },
  ConversationItem,
  ConversationList,
  EmojiPicker,
  FileAttachmentHandler,
  MessageItem,
  MessageList,
  PremiumBanner,
  TypingIndicator
};