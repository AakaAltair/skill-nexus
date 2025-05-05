// /home/user/new-skill-fire/app/snxai/page.tsx
'use client'; // This is a Client Component page

import React, { useState, useEffect, useRef } from 'react'; // Added React import
// Assuming your useAuth hook provides currentUser, idToken, and authLoading state
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import remarkGfm from 'remark-gfm';
// Import icons from lucide-react
import { Send, LoaderCircle, Info, BrainCircuit } from 'lucide-react';

import Modal from '@/components/Modal'; // Assuming Modal component is rooted at @/components
import styles from './snxai.module.css'; // Import the main page CSS module
import SNXaiInfoSidebar from './SNXaiInfoSidebar'; // Import the info sidebar component (in the same directory)


// Dynamically import ReactMarkdown
const DynamicReactMarkdown = dynamic(() => import('react-markdown'), {
  ssr: false, // Essential for client-side libraries
  loading: () => <div style={{ padding: '12px', animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>,
});

// --- Component Imports for Modals (Add your actual imports here) ---
// These are examples. Replace/add with the actual paths to your form components.
// import CreateProjectForm from '@/components/projects/CreateProjectForm';
// import CreateCommunityPostForm from '@/components/community/CreateCommunityPostForm';
// import ConfirmDeleteDialog from '@/components/common/ConfirmDeleteDialog'; // Example

// --- Types ---
// Defines the structure of a chat message
interface ChatTurn {
  role: 'user' | 'model'; // 'user' for user messages, 'model' for AI responses
  parts: { text: string }[]; // Array of text parts in the message
}

// Defines the structure of the state controlling the local modal
type LocalModalState = {
    id: string | null; // A string identifier for the type of modal content (e.g., 'createProjectForm')
    props: any; // An object containing any data or configuration needed by the modal content component
};

// --- Helper Component for Avatars ---
// Renders an avatar based on the role (user or AI)
const ChatAvatar = ({ role }: { role: 'user' | 'model' }) => {
    const { currentUser } = useAuth(); // Get current user from auth context

    // AI Avatar: Use a fixed icon or initials
    if (role === 'model') {
         // Use styles from snxai.module.css
        return (
            <div className={`${styles.avatarBase} ${styles.avatarModel}`}>
                {/* Using BrainCircuit icon for AI avatar */}
                <BrainCircuit size={20} /> {/* Adjust size as needed */}
            </div>
        );
    }

    // User Avatar: Use user's photo URL if available, otherwise use initials
    const initials = currentUser?.displayName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'; // Get initials or default to 'U'
    if (currentUser?.photoURL) {
         // Use styles from snxai.module.css for sizing and shape, image for src
        return <img src={currentUser.photoURL} alt="User Avatar" className={`${styles.avatarBase} ${styles.avatarImage}`} />;
    }
    // User Initials Fallback: Use styles from snxai.module.css
    return (
        <div className={`${styles.avatarBase} ${styles.avatarUser}`}>
            {initials}
        </div>
    );
};


// --- Main Page Component: SNXai Chatbot ---
export default function SNXaiPage() {
  // Get current user, their ID token, and auth loading state from useAuth hook
  const { currentUser, idToken, authLoading } = useAuth(); // *** Assuming useAuth provides authLoading ***

  // Get current pathname (useful for sending context to the API)
  const pathname = usePathname();

  // State for managing the chat messages displayed
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  // State for the text currently in the input field
  const [input, setInput] = useState('');
  // State to indicate if a message is being processed by the AI
  const [isLoading, setIsLoading] = useState(false); // isLoading for API call status
  // Ref to the last message element for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // State to manage the local modal (which modal is open and its props)
  const [localModalState, setLocalModalState] = useState<LocalModalState>({ id: null, props: null });

  // --- State and Toggle for Info Sidebar ---
  // The sidebar is permanently open now, but state is kept for potential future use or animation control
  const [isInfoSidebarOpen, setIsInfoSidebarOpen] = useState(true); // Set to true for permanent open sidebar
  // The toggle function is still needed for the close button in the sidebar
  const toggleInfoSidebar = () => setIsInfoSidebarOpen(!isInfoSidebarOpen);


  // --- Modal Management Functions ---
  // Function to open a specific modal by its ID and pass props
  const openLocalModal = (id: string, props?: any) => setLocalModalState({ id, props });
  // Function to close the currently open modal
  const closeLocalModal = () => setLocalModalState({ id: null, props: null });


  // --- Effect for Auto-scrolling ---
  // Scrolls to the bottom of the chat area whenever the 'messages' state changes
  useEffect(() => {
    // Ensure the ref is attached before attempting to scroll
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]); // Dependency array: re-run effect when messages state changes

   // --- Effect for Initial Welcome Message ---
   // Displays a welcome message when the page loads if no messages exist and the user is logged in
   useEffect(() => {
       // Check if messages are empty, not currently loading, and a user is logged in
       if (messages.length === 0 && !isLoading && currentUser) {
            // Welcome message adjusted slightly for the permanent sidebar
            const welcomeMessage = `Hi ${currentUser?.displayName?.split(' ')[0] || 'there'}! I'm SNXai, your intelligent assistant. Ask me anything about projects, placements, resources, or your profile. The sidebar on the left shows some things I can do and gives tips!`;
            setMessages([{ role: 'model', parts: [{ text: welcomeMessage }] }]);
       }
        // Potential future improvement: Load chat history from localStorage here
   }, [messages.length, isLoading, currentUser]); // Dependencies

    // --- Effect to Log Auth State Changes ---
    // Helps debug when currentUser or idToken become available
    useEffect(() => {
        console.log("Auth State Changed:");
        console.log("  authLoading:", authLoading);
        console.log("  currentUser:", currentUser);
        console.log("  idToken:", idToken ? 'Available' : 'Not Available');
    }, [authLoading, currentUser, idToken]);


  // --- Function to Send Message to Backend API ---
  // Handles sending the user's message to the /api/snxai endpoint
  const sendMessage = async () => {
    // --- DEBUG LOGS START ---
    console.log("--- Attempting to send message ---");
    console.log("Input value:", input);
    console.log("Input trimmed empty?", !input.trim());
    console.log("Is API loading (previous request)?", isLoading);
    console.log("Is Auth loading?", authLoading); // Log auth loading
    console.log("Current user:", currentUser);
    console.log("ID Token:", idToken ? 'Available' : 'Not Available');
    // --- DEBUG LOGS END ---

    // Prevent sending empty messages, sending while a request is pending,
    // or if user is NOT authenticated AND token is NOT available
    // Input/button are disabled based on these checks too, but this is a final safeguard
    if (!input.trim() || isLoading || !currentUser || !idToken) {
         console.warn("Message send aborted due to validation checks.");
         // --- DEBUG LOGS START ---
         if (!input.trim()) console.log("Reason: Input is empty.");
         if (isLoading) console.log("Reason: Still loading previous message.");
         if (!currentUser) console.log("Reason: User not authenticated (currentUser is null).");
         if (!idToken) console.log("Reason: ID token not available.");
         if (authLoading) console.log("Reason: Authentication is still loading."); // Log auth loading reason
         // --- DEBUG LOGS END ---
         // Add a subtle visual indication to the user? (Optional)
         // e.g., input.classList.add('shake-animation'); setTimeout(() => input.classList.remove('shake-animation'), 500);
         return; // Exit the function if checks fail
    }


    // Add the user's message to the chat state immediately for perceived speed
    const userMessage: ChatTurn = { role: 'user', parts: [{ text: input }] };
    // Use a functional update to ensure we have the latest state when adding
    setMessages(prevMessages => [...prevMessages, userMessage]);

    // Clear the input field and set loading state
    const currentInput = input; // Capture input value before clearing state
    setInput('');
    setIsLoading(true); // Start API loading indicator

    // --- DEBUG LOG ---
    console.log("Validation passed. Sending fetch request to /api/snxai...");

    try {
      // Make the POST request to the backend API route
      const response = await fetch('/api/snxai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Pass the user's ID token in the Authorization header for backend authentication
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          message: currentInput, // The user's message text
          // Send previous messages as history for the AI to maintain context
          // Filter out the initial welcome message or other system messages if needed
          history: messages.filter(msg => msg.role !== 'model' || msg.parts[0].text.startsWith('Error:')), // Example filter - refine if saving history
          // Pass current page context (optional for dedicated page but good practice)
          context: { pathname: pathname },
          // You could add other context data here, like visible element IDs if using a sidebar
        }),
      });

      // --- DEBUG LOG ---
       console.log("Fetch response received. Status:", response.status, "OK:", response.ok);


      // Handle non-OK HTTP responses from the API
      if (!response.ok) {
        const errorData = await response.json(); // Attempt to parse error body
        console.error('SNXai API error:', response.status, errorData);
        // Add an error message to the chat state
        setMessages(prev => [...prev, { role: 'model', parts: [{ text: `Error: ${errorData.message || 'An API error occurred.'}` }] }]);
      } else {
        // Process successful API response
        const data = await response.json(); // Parse the response body
        console.log("SNXai Response Body:", data); // Log the response structure

        // 1. Check for and display AI's text message
        if (data.aiMessage) {
            setMessages(prev => [...prev, { role: 'model', parts: [{ text: data.aiMessage }] }]);
        }

        // 2. Check for and handle Actions requested by the AI (e.g., open modal)
        // The backend decides when to trigger these UI actions
        if (data.action) {
            const { type, ...actionProps } = data.action;
            if (type === 'openModal') {
                // If the action is to open a modal, check if modalId is provided
                if (actionProps.modalId) {
                    console.log(`SNXai requested modal: ${actionProps.modalId}`, actionProps.data);
                    // Call the local function to update modal state, which triggers Modal rendering
                    openLocalModal(actionProps.modalId, actionProps.data);
                } else {
                     // Log and inform user if modal action is malformed
                     console.error('SNXai API requested to open modal but no modalId was provided.');
                     setMessages(prev => [...prev, { role: 'model', parts: [{ text: `Error: Received an instruction to open a modal, but the type was missing.` }] }]);
                }
            }
            // Add handlers for other action types here in the future (e.g., 'navigateTo', 'highlightElement')
        }

        // Note: The backend handles the tool execution and synthesis.
        // The frontend just displays the final aiMessage and handles UI actions.

      } // End if/else response.ok

    } catch (error: any) {
      // Handle errors that occur during the fetch itself (e.g., network errors)
      console.error('Failed to send message to SNXai:', error);
      // Display a generic error message in the chat
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: 'Sorry, an error occurred while sending your message.' }] }]);
    } finally {
      // Always stop loading after the API call finishes (either success or error)
      setIsLoading(false); // Stop API loading indicator
       // --- DEBUG LOG ---
       console.log("Message send process finished.");
    }
  }; // End of sendMessage function


    // --- Input Field Handling ---
    // Handles key presses in the input field, specifically for 'Enter'
    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // If Enter key is pressed and Shift key is NOT held
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent default form submission behaviour
            sendMessage(); // Call the sendMessage function
        }
         // Allow Shift + Enter for multi-line input (default browser behaviour)
    }; // End of handleKeyPress function


    // --- Function to render specific modal content locally ---
    // This function is passed to the <Modal> component as its `children`.
    // It dynamically determines which content/form component to render based on the modalId.
    const renderLocalModalContent = (modalId: string | null, modalProps: any) => {
         if (!modalId) return null; // Return null if no modalId is set (no modal should be open)

         // Use a switch statement to map modal IDs to components/JSX
         switch(modalId) {
             case 'confirmDelete':
                 // Renders a generic confirmation dialog
                 // This uses inline styles for simplicity, move to CSS Module for consistency
                 return (
                     <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                         <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>{modalProps?.title || "Confirm Action"}</h3>
                         <p style={{ color: '#374151', marginBottom: '1.5rem' }}>{modalProps?.message || "Are you sure?"}</p>
                         <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                             {/* Buttons call the handlers provided in modalProps AND close the modal */}
                             <button onClick={() => { modalProps?.onCancel?.(); closeLocalModal(); }} style={{ padding: '0.5rem 1.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', color: '#374151', backgroundColor: 'transparent', cursor: 'pointer' }}>Cancel</button>
                             <button onClick={() => { modalProps?.onConfirm?.(); closeLocalModal(); }} style={{ padding: '0.5rem 1.5rem', backgroundColor: '#FF4081', color: 'white', borderRadius: '0.375rem', border: 'none', cursor: 'pointer' }}>{modalProps?.confirmText || "Confirm"}</button>
                         </div>
                     </div>
                 );
             case 'createCommunityPostForm':
                 // Renders the form for creating a community post
                 // You MUST replace this placeholder with your actual form component
                 // Example: import CreateCommunityPostForm from '@/components/community/CreateCommunityPostForm';
                 // return <CreateCommunityPostForm initialData={modalProps?.initialData} onClose={closeLocalModal} />;
                 // Placeholder JSX:
                 return (
                     <div style={{ padding: '1.5rem' }}>
                         <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Create Community Post</h3>
                         <p style={{ marginBottom: '1rem' }}>Placeholder: Your community post form goes here.</p>
                         {/* Display any initial text provided by the AI */}
                         {modalProps?.initialData?.textContent && (
                             <p style={{ color: '#6b7280', marginTop: '0.5rem'}}>Initial text: "{modalProps.initialData.textContent}"</p>
                         )}
                         {/* Add other initial data fields display if needed */}
                         <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                             {/* This button only closes the placeholder modal */}
                             <button onClick={closeLocalModal} style={{ padding: '0.5rem 1rem', backgroundColor: '#e5e7eb', borderRadius: '0.375rem', border: 'none', cursor: 'pointer' }}>Close Placeholder</button>
                         </div>
                     </div>
                 );
             case 'createProjectForm':
                  // Renders the form for creating a project
                  // You MUST replace this placeholder with your actual form component
                  // Example: import CreateProjectForm from '@/components/projects/CreateProjectForm';
                  // return <CreateProjectForm initialData={modalProps?.initialData} onClose={closeLocalModal} />;
                 // Placeholder JSX:
                 return (
                     <div style={{ padding: '1.5rem' }}>
                         <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Create New Project</h3>
                         <p style={{ marginBottom: '1rem' }}>Placeholder: Your project creation form goes here.</p>
                         {modalProps?.initialData?.initialTitle && (
                             <p style={{ color: '#6b7280', marginTop: '0.5rem'}}>Initial title: "{modalProps.initialData.initialTitle}"</p>
                         )}
                         <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                             {/* This button only closes the placeholder modal */}
                             <button onClick={closeLocalModal} style={{ padding: '0.5rem 1rem', backgroundColor: '#e5e7eb', borderRadius: '0.375rem', border: 'none', cursor: 'pointer' }}>Close Placeholder</button>
                         </div>
                     </div>
                 );

            // --- Add cases for other forms/content you might trigger from SNXai ---
            // case 'editSummary':
            //     // Example: import EditProfileSummaryForm from '@/components/dashboard/EditSummaryForm';
            //     // return <EditProfileSummaryForm {...modalProps} onClose={closeLocalModal} />;


            default:
                // Fallback case if a requested modalId is not mapped
                console.warn(`Local modal content mapping missing for ID: ${modalId}.`);
                return (
                    <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Error</h3>
                        <p>Cannot display content for requested modal type: {modalId}</p>
                        <button onClick={closeLocalModal} style={{ marginTop: '1.5rem', padding: '0.5rem 1rem', backgroundColor: '#e5e7eb', borderRadius: '0.375rem', border: 'none', cursor: 'pointer' }}>Close</button>
                    </div>
                 );
         }
    }; // End of renderLocalModalContent function


  // --- Main Rendered JSX ---
  return (
    // Use React Fragment <> to render multiple top-level elements (sidebar and main page content)
    // This is necessary if the sidebar is a sibling element in the DOM structure.
    // If the sidebar is permanently positioned, it might not need to be a sibling here,
    // but this structure works for both overlay and permanent sidebars.
    <>
      {/* Info Sidebar Component - Renders itself and its overlay */}
      {/* Its visibility is controlled by the isInfoSidebarOpen state */}
      {/* If the sidebar is *always* open, you might not need the isOpen prop */}
      {/* But keeping it allows flexibility for animation or mobile view */}
       <SNXaiInfoSidebar isOpen={isInfoSidebarOpen} onClose={toggleInfoSidebar} />

      {/* Main container for the page layout */}
      {/* Uses CSS Module class for styling the overall chatbot container */}
       <div className={styles.pageContainer}>
           {/* "Experimental" Tag - Positioned absolutely via CSS module */}
           <div className={styles.experimentalTag}>Experimental</div>

        {/* Header using CSS Module */}
        {/* Contains the title, AI avatar, and the Info button */}
        <div className={styles.header}>
           <ChatAvatar role="model" /> {/* AI Avatar in the header */}
           <h1 className={styles.headerTitle}>SNXai Chatbot</h1> {/* Chatbot title */}
           {/* Info Button to toggle the sidebar */}
           {/* Uses CSS Module class for styling */}
           {/* Clicking this button updates the isInfoSidebarOpen state */}
           {/* Keep the Info button even if sidebar is permanently open, it can now close it */}
           <button
               onClick={toggleInfoSidebar}
               className={styles.infoButton}
               aria-label="Show SNXai Info" // Accessibility label
           >
               <Info size={20} /> {/* Info icon from lucide-react */}
           </button>
        </div>

        {/* Chat Messages Area */}
        {/* This area grows to fill remaining vertical space and is scrollable */}
        {/* Uses CSS Module class for styling */}
        <div className={styles.chatArea}>
          <div className={styles.messageList}> {/* Container for messages with spacing */}
              {/* Map over the messages array to display each message */}
              {messages.map((msg, index) => (
              // Container for each message row (includes avatar and bubble)
              // Uses CSS Module classes for layout and role-based alignment
              <div
                  key={index} // Unique key for list rendering (essential for React lists)
                  className={`${styles.messageRow} ${msg.role === 'user' ? styles.messageRowUser : styles.messageRowModel}`}
              >
                  {/* Conditionally render AI avatar on the left */}
                  {msg.role === 'model' && <ChatAvatar role="model" />}

                  {/* Message Bubble */}
                  {/* Uses CSS Module classes for styling and role-based colours/corners */}
                  <div className={`${styles.bubbleBase} ${ msg.role === 'user' ? styles.bubbleUser : styles.bubbleModel }`}>
                      {/* Container for plain text content */}
                      {/* Uses CSS Module class for preserving whitespace */}
                      {/* Using plain text render now due to persistent Markdown issues */}
                      <p className={styles.plainTextContent}>
                          {/* Join text parts into a single string */}
                          {msg.parts.map(part => part.text).join('')}
                      </p>
                       {/* If plain text works, and you want to try Markdown again later,
                           uncomment the DynamicReactMarkdown block below and comment out the <p> above.
                           If you still get errors, you may need to research ReactMarkdown/Next.js/Turbopack
                           compatibility or use a different Markdown library.
                       */}
                       {/*
                       <div className={styles.markdownContent}>
                           <DynamicReactMarkdown remarkPlugins={[remarkGfm]}>
                               {String(msg.parts.map(part => part.text).join(''))}
                           </DynamicReactMarkdown>
                       </div>
                        */}
                  </div>

                  {/* Conditionally render User avatar on the right */}
                  {msg.role === 'user' && <ChatAvatar role="user" />}
              </div>
              ))}
          </div>
          {/* Empty div as a scroll target - scrollsIntoView will target this */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        {/* Contains the text input and send button */}
        {/* Uses CSS Module class for styling */}
        <div className={styles.inputArea}>
          {/* Show login prompt if user is not logged in OR authentication is loading */}
          {!currentUser ? (
              authLoading ? ( // Display "Loading authentication..." if auth is loading
                 <div className={styles.loginPrompt}>Loading authentication...</div>
              ) : ( // Display "Please sign in..." if auth is finished but no user
                 <div className={styles.loginPrompt}>Please sign in to chat with SNXai.</div>
              )
          ) : (
              // Form element for the input field and send button
              // Uses CSS Module class for layout
              <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className={styles.inputForm}>
                  {/* Text input field */}
                  {/* Uses CSS Module class for styling */}
                  <input
                      type="text"
                      className={styles.textInput}
                      placeholder={isLoading ? 'SNXai is thinking...' : 'Chat with SNXai...'} // Dynamic placeholder
                      value={input} // Controlled component: input value tied to state
                      onChange={(e) => setInput(e.target.value)} // Update state on change
                      // Disable input while authLoading, API isLoading, or input is empty (button also checks trim)
                      disabled={authLoading || isLoading || !idToken} // *** Disable if auth loading or token not ready ***
                      aria-label="Chat input" // Accessibility label
                  />
                  {/* Send button with Icon */}
                  {/* Uses CSS Module class for styling, type="submit" to work with form */}
                  <button
                      type="submit" // Submit the form
                      className={styles.sendButton}
                      // Disable if authLoading, API isLoading, or input is empty
                      disabled={authLoading || isLoading || !input.trim() || !idToken} // *** Disable if auth loading or token not ready ***
                      aria-label="Send message" // Accessibility label
                  >
                      {/* Conditional Rendering: Spinner or Send Icon */}
                      {isLoading ? (
                           // Lucid icon for loading spinner
                           // Uses CSS module class for animation
                          <LoaderCircle size={20} className={styles.spinner} />
                      ) : (
                           // Lucid icon for send button
                           // Use CSS module class for rotation and potential hover effects
                          <Send size={20} className={styles.sendButtonIcon} /> // Assuming sendButtonIcon class is defined in CSS
                           // If you just applied transform directly: style={{ transform: 'rotate(30deg)' }}
                      )}
                  </button>
              </form>
          )}
        </div> {/* End of .inputArea */}

        {/* --- Local Modal Component Rendering --- */}
        {/* The Modal component is rendered conditionally based on localModalState.id */}
        {/* If localModalState.id is not null, the Modal is rendered and is open */}
        {localModalState.id !== null && (
             <Modal
                 isOpen={localModalState.id !== null} // Pass current open state (redundant but harmless)
                 onClose={closeLocalModal} // Pass the function to close the modal
                 // Pass the content to the Modal via its `children` prop
                 // Call renderLocalModalContent to get the appropriate JSX based on the modalId
             >
                 {renderLocalModalContent(localModalState.id, localModalState.props)}
             </Modal>
        )}

      </div> {/* End of .pageContainer */}
    </> // End of Fragment
  ); // End of return statement
} // End of SNXaiPage function component