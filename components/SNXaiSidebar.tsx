// components/SNXaiSidebar.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext'; // Use your AuthContext hook
// import { usePathname } from 'next/navigation'; // You might need this later for context
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; // For GitHub Flavored Markdown

// Define the shape of a chat turn (as brainstormed earlier)
interface ChatTurn {
  role: 'user' | 'model';
  parts: { text: string }[];
  // Optional: action property if the AI tells the frontend to do something specific
  // action?: { type: string; [key: string]: any; };
}

// Define props for the sidebar component
interface SNXaiSidebarProps {
    isOpen: boolean; // Passed from LayoutUI
    onClose: () => void; // Passed from LayoutUI to close the sidebar
    // Function to request opening a modal from the LayoutUI
    requestOpenModal: (modalId: string, modalProps?: any) => void;
    // Optional: Pass context data like current page
    currentPageContext?: { pathname: string };
}

export default function SNXaiSidebar({
    isOpen,
    onClose,
    requestOpenModal,
    currentPageContext
}: SNXaiSidebarProps) {
  const { currentUser, idToken } = useAuth(); // Get auth state and token

  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null); // For auto-scrolling

  // Auto-scroll to the latest message when messages update or sidebar opens
  useEffect(() => {
    if (isOpen) { // Only scroll when sidebar is actually visible
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, isOpen]);


  // --- Placeholder/Initial Message Logic ---
   useEffect(() => {
       if (isOpen && messages.length === 0 && !isLoading) {
            // Display a welcome message when the sidebar is first opened and there are no messages
             const welcomeMessage = `Hi ${currentUser?.displayName?.split(' ')[0] || 'there'}! I'm SNXai, your platform assistant. What can I help you with today? (e.g., "Show me projects", "Update my summary", "Find profiles")`;
             setMessages([{ role: 'model', parts: [{ text: welcomeMessage }] }]);
       }
        // Note: Persistent chat history (via localStorage) can be added here later
   }, [isOpen, messages.length, isLoading, currentUser]);


  const sendMessage = async () => {
    if (!input.trim() || isLoading || !currentUser || !idToken) return; // Prevent sending empty messages or when loading/not logged in

    const userMessage: ChatTurn = { role: 'user', parts: [{ text: input }] };
    // Use a functional update to ensure we have the latest state
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/snxai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`, // Pass the user's ID token
        },
        body: JSON.stringify({
          message: input,
          // Send previous messages as history (exclude welcome message if not part of history)
          history: messages.filter(msg => msg.role !== 'model' || msg.parts[0].text.startsWith('Error:') || msg.parts[0].text.startsWith('Okay,')), // Simple filter example
          context: currentPageContext, // Pass current page context
          // Add any other relevant context data here (e.g., selected project ID, user ID from profile page)
           // Requires reading route parameters, which is a bit more involved in App Router Client Components
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('SNXai API error:', response.status, errorData);
        setMessages(prev => [...prev, { role: 'model', parts: [{ text: `Error: ${errorData.message || 'An API error occurred.'}` }] }]);
        return;
      }

      const data = await response.json();
       console.log("SNXai Response:", data); // Log response structure for debugging

      // --- Process AI Response ---

      // 1. Add AI's text message
      if (data.aiMessage) {
          setMessages(prev => [...prev, { role: 'model', parts: [{ text: data.aiMessage }] }]);
      }

      // 2. Handle Actions requested by the AI (e.g., open modal)
      if (data.action) {
          const { type, ...actionProps } = data.action;
          if (type === 'openModal') {
              if (actionProps.modalId) {
                  console.log(`SNXai requested modal: ${actionProps.modalId}`, actionProps.data);
                  // Call the function passed from the layout to open the modal
                  requestOpenModal(actionProps.modalId as ModalContentId, actionProps.data);
              } else {
                   console.error('SNXai API requested to open modal but no modalId was provided.');
                   setMessages(prev => [...prev, { role: 'model', parts: [{ text: `Error: AI requested a modal but didn't specify which one.` }] }]);
              }
          }
          // Add handlers for other action types here in the future (e.g., 'navigateTo', 'highlightElement')
      }

      // 3. Handle Tool Results (if AI executed tools and returned results for synthesis)
      // This would be part of the advanced tool calling logic in the backend API
      // if (data.toolResults) { ... process results and potentially send back to AI ... }


    } catch (error: any) {
      console.error('Failed to send message to SNXai:', error);
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: 'Sorry, I encountered an error trying to process your request.' }] }]);
    } finally {
      setIsLoading(false);
    }
  };


    // Prevent sending message on Enter key if Shift is held (for multi-line input)
    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent default form submission
            sendMessage();
        }
    };


  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200"> {/* Added border for separation */}
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-xl font-bold text-black">SNXai</h2>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-black" aria-label="Close SNXai Chat">
          {/* Simple X icon */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-lg ${
              msg.role === 'user'
                ? 'bg-accent1 text-white rounded-br-none' // Use accent1 for user messages
                : 'bg-gray-100 text-black rounded-bl-none' // Use light gray for model messages
            }`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {msg.parts.map(part => part.text).join('')} {/* Render text parts */}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} /> {/* Scroll target */}
      </div>

      {/* Chat Input Area */}
      <div className="p-4 border-t border-gray-200 flex items-center">
        {/* Show input only if logged in */}
        {!currentUser ? (
            <div className="text-center text-sm text-gray-600 w-full">Please sign in to chat with SNXai.</div>
        ) : (
            <>
                <input
                type="text"
                className="flex-grow px-4 py-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-accent1 focus:border-accent1 text-black bg-white placeholder-gray-400" // Added placeholder color
                placeholder={isLoading ? 'SNXai is thinking...' : 'Chat with SNXai...'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress} // Use the custom handler
                disabled={isLoading}
                />
                <button
                onClick={sendMessage}
                className={`px-4 py-2 bg-accent1 text-white rounded-r-lg hover:bg-accent1/90 focus:outline-none focus:ring-2 focus:ring-accent1 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                disabled={isLoading || !input.trim()}
                >
                {isLoading ? (
                    <svg className="animate-spin h-5 w-5 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0116 0H4z"></path>
                    </svg>
                ) : (
                   'Send' // Or a Send icon
                )}
                </button>
            </>
        )}
      </div>
    </div>
  );
}