"use client";

import React, { useEffect, useState, useRef, FormEvent, KeyboardEvent } from "react"; // Import KeyboardEvent
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- Define structure matching Gemini API Content ---
interface ChatPart {
    text: string;
}
interface ChatTurn {
    role: 'user' | 'model';
    parts: ChatPart[];
    id: string; // Unique ID for React keys
}
// --- End structure definition ---


export default function NexaiChat() {
    // --- State ---
    const [conversation, setConversation] = useState<ChatTurn[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null); // Ref for textarea

    // --- Auto-scroll to bottom ---
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: conversation.length > 1 ? "smooth" : "auto" });
    }, [conversation]);

    // --- Auto-resize Textarea ---
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto'; // Reset height
            const scrollHeight = textarea.scrollHeight;
            // Set height based on content, max out at ~6 lines (adjust as needed)
            textarea.style.height = `${Math.min(scrollHeight, 120)}px`;
        }
    }, [input]); // Adjust height when input changes

    // --- Set Welcome Message ---
    useEffect(() => {
        setConversation([
            {
                role: "model",
                parts: [{ text: "👋 Welcome to Nexai!\nI'm Nexai, your friendly tech mentor. How can I help you today? Are you interested in exploring any specific tech areas, looking for project ideas, or just curious about the latest trends? Let me know!" }],
                id: crypto.randomUUID(),
            },
        ]);
    }, []); // Run only once on mount

    // --- Core Logic to Send Message ---
    const sendMessage = async () => {
        const userMessageText = input.trim();
        if (!userMessageText || isLoading) return;

        const newUserTurn: ChatTurn = { role: "user", parts: [{ text: userMessageText }], id: crypto.randomUUID() };
        let historyForAPI: { role: 'user' | 'model'; parts: ChatPart[] }[] = [];
        if (conversation.length > 0) { historyForAPI = conversation.map(({ role, parts }) => ({ role, parts })); }

        setConversation((prev) => [...prev, newUserTurn]);
        setInput(""); // Clear input AFTER sending
        setIsLoading(true);

        // Reset textarea height after clearing input
        if (textareaRef.current) {
             textareaRef.current.style.height = 'auto';
        }


        try {
            console.log("🔄 Sending to API:", { message: userMessageText, history: historyForAPI });
            const res = await fetch("/api/nexai", { // Ensure API route exists
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMessageText, history: historyForAPI }),
            });

            if (!res.ok) {
                let errorMsg = `API Error: ${res.status} ${res.statusText}`;
                try { const errorData = await res.json(); errorMsg = errorData.response || errorMsg; } catch { /* Ignore */ }
                throw new Error(errorMsg);
            }
            const data = await res.json();
             if (typeof data.response !== 'string') {
                 throw new Error("Received invalid response format.");
             }

            const newModelTurn: ChatTurn = { role: "model", parts: [{ text: data.response }], id: crypto.randomUUID() };
            setConversation((prev) => [...prev, newModelTurn]);

        } catch (err: any) {
            console.error("❌ Fetch error details:", err);
            const errorTurn: ChatTurn = { role: "model", parts: [{ text: `⚠️ Error: ${err.message || "Could not get response."}` }], id: crypto.randomUUID() };
            setConversation((prev) => [...prev, errorTurn]);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Handle Form Submission (Triggered by button click) ---
    const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault(); // Prevent default browser form submission
        sendMessage(); // Call the core send logic
    };

    // --- Handle Keydown in Textarea ---
    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        // Check if Enter is pressed WITHOUT Shift or Ctrl
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
            e.preventDefault(); // Prevent newline in textarea
            sendMessage();     // Trigger send logic
        }
        // If Shift+Enter or Ctrl+Enter is pressed, the default behavior (newline) is allowed
    };


    // --- Render Component ---
    return (
        // Main container
        <div className="flex flex-col items-center justify-center min-h-screen bg-white text-black p-20 font-sans">
            {/* Chat Window */}
            <div className="w-full lg:w-4/5 xl:w-3/4 max-w-screen-xl bg-white shadow-lg rounded-xl border border-gray-200 flex flex-col h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-3 border-b border-gray-200 text-center">
                    <h1 className="text-lg font-semibold text-gray-700">Nexai</h1>
                </div>

                {/* Chat Messages Area */}
                <div className="flex-1 p-4 md:p-6 space-y-3 overflow-y-auto">
                    {conversation.map((turn) => {
                        const textContent = turn.parts?.[0]?.text;
                        if (typeof textContent !== 'string') return null;
                        const isUser = turn.role === 'user';
                        const bubbleBaseStyles = "p-3 rounded-lg border border-gray-200 shadow-sm whitespace-pre-wrap break-words bg-white";
                        const userStyles = "rounded-br-none border-l-2 border-l-blue-500 max-w-md lg:max-w-lg ml-auto"; // Added ml-auto for right alignment
                        const botStyles = "rounded-bl-none border-r-2 border-r-green-500 max-w-md md:w-3/5 lg:max-w-lg";

                        return (
                            <div
                                key={turn.id}
                                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                            >
                                <div className={`${bubbleBaseStyles} ${isUser ? userStyles : botStyles}`}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {textContent}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        );
                     })}

                    {/* Loading Indicator */}
                    {isLoading && (
                         <div className="flex justify-start">
                             <div className="p-3 rounded-lg max-w-xs border border-gray-200 rounded-bl-none border-r-2 border-r-gray-400">
                                 {/* Simple pulsing dots for loading */}
                                <div className="flex space-x-1 items-center">
                                     <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse animation-delay-75"></span>
                                     <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse animation-delay-150"></span>
                                     <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse animation-delay-300"></span>
                                </div>
                             </div>
                         </div>
                    )}
                    {/* Scroll anchor */}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Section */}
                {/* Use handleFormSubmit for the form's onSubmit */}
                <form onSubmit={handleFormSubmit} className="p-4 border-t border-gray-200 flex items-end gap-3 bg-gray-50"> {/* Use items-end */}
                     {/* Textarea instead of Input */}
                     <textarea
                        ref={textareaRef} // Assign ref
                        rows={1} // Start with one row
                        className="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-2 text-black placeholder-gray-400 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-none overflow-y-auto" // Added resize-none, overflow-y-auto
                        placeholder="Ask Nexai... (Shift+Enter for new line)" // Updated placeholder
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown} // Add keydown handler
                        disabled={isLoading}
                        aria-label="Chat input"
                        style={{ maxHeight: '240px' }} // Limit max height (~6 lines)
                    />
                    <button
                        type="submit" // Button still triggers form submit
                        className={`self-end px-5 py-2 rounded-lg border border-gray-300 bg-white text-black font-medium text-sm hover:border-blue-500 hover:text-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-200 disabled:opacity-60 disabled:cursor-not-allowed`} // Added self-end
                        disabled={isLoading || !input.trim()} // Also disable if input is empty
                    >
                        {/* Send Icon or Spinner */}
                        {isLoading ? (
                             <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                             </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                              <path d="M3.105 3.105a.75.75 0 0 1 .814-.156l14.692 8.007a.75.75 0 0 1 0 1.302l-14.692 8.007a.75.75 0 0 1-1.118-.982l2.54-7.024a.75.75 0 0 0 0-.39l-2.54-7.024a.75.75 0 0 1 .304-1.134Z" />
                            </svg>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}