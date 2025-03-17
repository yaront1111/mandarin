"use client"

import { useState, useEffect, useRef } from "react"
import axios from "axios"
import { toast } from "react-toastify"
import { ChatIcon, SendIcon } from "@heroicons/react/24/outline"
import { LoadingState, LoadingButton } from "../components/common/LoadingState"

const MessageBubble = ({ message, isOwn, onRetry }) => {
  const bubbleClass = isOwn ? "bg-blue-500 text-white self-end" : "bg-gray-200 text-gray-800 self-start"
  const statusIndicator = message.status === "sending" ? "..." : message.status === "failed" ? "!" : ""
  const retryButton =
    message.status === "failed" ? (
      <button onClick={onRetry} className="text-sm text-blue-500">
        Retry
      </button>
    ) : null

  return (
    <div className={`flex flex-col ${bubbleClass} rounded-xl p-2 my-1 max-w-xs break-words`}>
      <div className="text-sm">{message.content}</div>
      <div className="text-xs text-gray-400 self-end">
        {new Date(message.createdAt).toLocaleTimeString()} {statusIndicator} {retryButton}
      </div>
    </div>
  )
}

const Messages = ({ activeConversation, currentUser }) => {
  const [messages, setMessages] = useState([])
  const [messageText, setMessageText] = useState("")
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const messagesContainerRef = useRef(null)

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setLoading(true)
        const response = await axios.get(`/api/conversations/${activeConversation}/messages`)
        setMessages(response.data)
      } catch (error) {
        console.error("Failed to fetch messages:", error)
        toast.error("Could not load messages")
      } finally {
        setLoading(false)
      }
    }

    if (activeConversation) {
      fetchMessages()
    }
  }, [activeConversation])

  useEffect(() => {
    // Scroll to bottom when messages change
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!messageText.trim()) return

    const tempId = Date.now().toString()
    const newMessage = {
      _id: tempId,
      sender: currentUser._id,
      content: messageText,
      createdAt: new Date().toISOString(),
      status: "sending",
    }

    // Optimistically add message to UI
    setMessages((prev) => [...prev, newMessage])
    setMessageText("")

    try {
      setSending(true)
      const response = await axios.post(`/api/conversations/${activeConversation}/messages`, {
        content: messageText,
        type: "text",
      })

      // Update with actual message from server
      setMessages((prev) => prev.map((msg) => (msg._id === tempId ? response.data : msg)))
    } catch (error) {
      console.error("Failed to send message:", error)
      toast.error("Failed to send message")

      // Mark message as failed
      setMessages((prev) => prev.map((msg) => (msg._id === tempId ? { ...msg, status: "failed" } : msg)))
    } finally {
      setSending(false)
    }
  }

  const handleRetry = async (failedMessage) => {
    try {
      // Optimistically update status to sending
      setMessages((prev) => prev.map((msg) => (msg._id === failedMessage._id ? { ...msg, status: "sending" } : msg)))

      const response = await axios.post(`/api/conversations/${activeConversation}/messages`, {
        content: failedMessage.content,
        type: "text",
      })

      // Update with actual message from server
      setMessages((prev) => prev.map((msg) => (msg._id === failedMessage._id ? response.data : msg)))
    } catch (error) {
      console.error("Failed to resend message:", error)
      toast.error("Failed to resend message")

      // Mark message as failed again
      setMessages((prev) => prev.map((msg) => (msg._id === failedMessage._id ? { ...msg, status: "failed" } : msg)))
    }
  }

  return (
    <div className="flex flex-col h-full">
      {activeConversation ? (
        <>
          <div className="flex-1 overflow-y-auto p-4" ref={messagesContainerRef}>
            {loading ? (
              <LoadingState text="Loading messages..." />
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <ChatIcon className="h-12 w-12 mb-4 text-gray-300" />
                <p>No messages yet</p>
                <p className="text-sm">Start the conversation!</p>
              </div>
            ) : (
              messages.map((message) => (
                <MessageBubble
                  key={message._id}
                  message={message}
                  isOwn={message.sender === currentUser._id}
                  onRetry={message.status === "failed" ? () => handleRetry(message) : undefined}
                />
              ))
            )}
          </div>
          <div className="border-t p-4">
            <form onSubmit={sendMessage} className="flex items-center gap-2">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={sending}
              />
              <LoadingButton
                type="submit"
                loading={sending}
                disabled={!messageText.trim()}
                className="bg-primary text-white rounded-full p-2 hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Send message"
              >
                <SendIcon className="h-5 w-5" />
              </LoadingButton>
            </form>
          </div>
        </>
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-gray-500">
          <ChatIcon className="h-16 w-16 mb-4 text-gray-300" />
          <p className="text-lg">Select a conversation</p>
          <p className="text-sm">Choose a conversation from the list to start chatting</p>
        </div>
      )}
    </div>
  )
}

export default Messages
