// components/Modal.tsx
"use client";

import { Fragment, ReactNode, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  // We will now use children to pass the content dynamically
  children: ReactNode;
  // Optional: Add a title if you want a generic header, but you can also
  // handle the title and close button within the children content for more flexibility.
  // title?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  // title // If you add a generic title
}) => {

    // --- Body Scroll Lock ---
    useEffect(() => {
        if (isOpen) {
            const originalStyle = window.getComputedStyle(document.body).overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalStyle;
            };
        }
    }, [isOpen]);


    // If the modal is not open, don't render anything to the DOM
    if (!isOpen) return null;


  return (
    // Use Headless UI Transition and Dialog
    // z-index should be high enough to be above all other page content
    <Transition appear show={isOpen} as={Fragment}>
      {/* The Dialog component handles the backdrop click and Esc key press to call onClose */}
      <Dialog as="div" className="relative z-50" onClose={onClose}> {/* Adjusted z-index */}
        {/* Backdrop overlay */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
           {/* Apply your styling for the overlay here */}
          <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm" />
        </Transition.Child>

        {/* Full-screen container for centering the modal */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center"> {/* Use padding from design guidelines */}
            {/* Modal Panel */}
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              {/* Apply your styling for the modal panel here */}
              <Dialog.Panel
                className={`w-full max-w-md transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all`} // Reverted max-w-md, adjust as needed
              >
                {/*
                  Optionally include a generic header here if your modal content
                  doesn't handle its own title/close button.
                */}
                 {/* {title && (
                     <div className="flex justify-between items-center p-6 border-b">
                          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
                          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                          </button>
                     </div>
                 )} */}


                {/* Render the children passed to the modal */}
                {/* Add padding here if you want the children content to have consistent padding */}
                <div className="p-6">{children}</div> {/* Added padding around children */}

              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default Modal;