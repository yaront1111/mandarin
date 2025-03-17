"use client"
import { formatDistanceToNow } from "date-fns"
import { CheckIcon, ClockIcon, AlertCircleIcon, RefreshCwIcon as RefreshIcon } from "lucide-react"

const MessageBubble = ({ message, isOwn, onRetry }) => {
  const getStatusIcon = () => {
    if (message.status === "sending") {
      return <ClockIcon className="h-3 w-3 text-gray-400" />
    } else if (message.status === "failed") {
      return <AlertCircleIcon className="h-3 w-3 text-red-500" />
    } else if (message.read) {
      return <CheckIcon className="h-3 w-3 text-blue-500" />
    } else {
      return <CheckIcon className="h-3 w-3 text-gray-400" />
    }
  }

  return (
    <div className={`flex mb-4 ${isOwn ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] ${isOwn ? "order-1" : "order-2"}`}>
        <div
          className={`rounded-lg px-4 py-2 ${
            isOwn ? "bg-primary text-white rounded-br-none" : "bg-gray-100 text-gray-800 rounded-bl-none"
          }`}
        >
          {message.content}
        </div>

        <div className={`flex items-center mt-1 text-xs text-gray-500 ${isOwn ? "justify-end" : "justify-start"}`}>
          <span>{formatDistanceToNow(new Date(message.createdAt))} ago</span>

          {isOwn && <span className="ml-2 flex items-center">{getStatusIcon()}</span>}

          {message.status === "failed" && onRetry && (
            <button
              onClick={onRetry}
              className="ml-2 text-red-500 hover:text-red-700 focus:outline-none"
              aria-label="Retry sending message"
            >
              <RefreshIcon className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default MessageBubble
