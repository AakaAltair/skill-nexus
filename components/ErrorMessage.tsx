// components/ErrorMessage.tsx
import React from 'react';

interface ErrorMessageProps {
    message: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
    if (!message) return null; // Don't render if there's no message

    return (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold mr-1">Error:</strong>
            <span className="block sm:inline">{message}</span>
            {/* Optional: Add a close button if you want */}
            {/* <span className="absolute top-0 bottom-0 right-0 px-4 py-3">
                <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15L5.65 5.15a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.03a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.15 2.758 3.151a1.2 1.2 0 0 1 0 1.698z"/></svg>
            </span> */}
        </div>
    );
};

export default ErrorMessage;