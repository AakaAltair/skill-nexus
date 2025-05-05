// components/RootLayoutClient.tsx
'use client';

import { useState, useEffect, ReactNode } from 'react';
import Navbar from './Navbar'; // Assuming Navbar is here
import SNXaiSidebar from './SNXaiSidebar';
import Modal from './Modal'; // Assuming your reusable Modal is here

// Define a type for the modal content/props
type ModalState = {
  id: string | null; // Identifier for the type of modal content (e.g., 'editSummary', 'confirmDelete', 'createProjectForm')
  props: any; // Props to pass to the specific form/content component rendered inside the modal
};

export default function RootLayoutClient({ children }: { children: ReactNode }) {
  const [isSNXaiSidebarOpen, setIsSNXaiSidebarOpen] = useState(false);
  const [modalState, setModalState] = useState<ModalState>({ id: null, props: null });
  const [snxaiHasNotification, setSnxaiHasNotification] = useState(false); // Optional: for future proactive features

  // Function to trigger opening a modal from anywhere (e.g., SNXai Sidebar)
  const openModal = (id: string, props?: any) => {
    setModalState({ id, props });
  };

  // Function to close the modal
  const closeModal = () => {
    setModalState({ id: null, props: null });
    // You might also want to reset notification state here if a suggestion opened the modal
    // setSnxaiHasNotification(false);
  };

  // Effect to potentially manage body scroll when sidebar/modal is open
  useEffect(() => {
    if (isSNXaiSidebarOpen || modalState.id !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    // Clean up effect
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isSNXaiSidebarOpen, modalState.id]);


  // Function to toggle the sidebar visibility
  const toggleSNXaiSidebar = () => {
    setIsSNXaiSidebarOpen(!isSNXaiSidebarOpen);
    // If sidebar opens, clear potential notification badge
    if (!isSNXaiSidebarOpen && snxaiHasNotification) {
        setSnxaiHasNotification(false);
    }
  };

  // Function for SNXaiSidebar to request opening a modal
  // SNXaiSidebar will call this: `requestOpenModal('editSummary', { initialData: ... })`
  const requestSNXaiModal = (modalId: string, modalProps?: any) => {
      openModal(modalId, modalProps);
  };


  return (
    <>
      {/* Navbar is always visible */}
      <Navbar />

      {/* Main content area, padded at the top to clear the fixed Navbar */}
      {/* Optional: Add padding-right/margin-right here if sidebar overlaps critical content */}
      <main className="flex-grow pt-16">{children}</main>

      {/* SNXai Toggle Button */}
      <button
        className={`fixed bottom-6 right-6 z-50 p-3 rounded-full shadow-lg transition-all duration-300 ease-in-out
                   ${isSNXaiSidebarOpen ? 'rotate-90 opacity-0' : 'rotate-0 opacity-100'}
                   bg-accent1 text-white hover:bg-accent1/90 focus:outline-none focus:ring-2 focus:ring-accent1 focus:ring-offset-2
                   ${snxaiHasNotification ? 'animate-bounce' : ''} // Optional: Add a bounce animation for notifications
                   `}
        onClick={toggleSNXaiSidebar}
        aria-label="Open SNXai Chat"
      >
        {/* Replace with an actual AI/Robot/Chat Icon */}
        🤖
        {/* Optional Notification Badge */}
         {snxaiHasNotification && (
             <span className="absolute top-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white bg-accent2"></span>
         )}
      </button>

      {/* SNXai Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-full md:w-96 z-50 shadow-xl transform transition-transform duration-300 ease-in-out bg-white
                   ${isSNXaiSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <SNXaiSidebar
            isOpen={isSNXaiSidebarOpen}
            onClose={() => setIsSNXaiSidebarOpen(false)}
            requestOpenModal={requestSNXaiModal} // Pass the function down
        />
      </div>

      {/* Optional: Overlay behind sidebar for better UX */}
       {isSNXaiSidebarOpen && (
           <div
               className="fixed inset-0 z-40 bg-black opacity-30 transition-opacity duration-300"
               onClick={toggleSNXaiSidebar} // Close sidebar on clicking overlay
               aria-hidden="true"
           ></div>
       )}


      {/* Global Modal Component */}
      {/* Pass the state and the closeModal function */}
      <Modal
        isOpen={modalState.id !== null}
        onClose={closeModal}
        // You'll need a way for the Modal to render different content based on modalState.id
        // This could be via children or a render prop, or by passing modalState.id and having
        // Modal component internally decide what to render based on a map.
        // Let's assume Modal takes modalState as a prop for now and handles content rendering internally.
        // You might need to adjust your existing Modal component.
        modalContentId={modalState.id}
        modalContentProps={modalState.props}
      >
          {/* Modal content will be handled inside the Modal component based on modalContentId/Props */}
      </Modal>

    </>
  );
}