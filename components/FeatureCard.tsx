// components/FeatureCard.tsx - Simplified for diverse layouts on homepage
import Link from 'next/link';
import React from 'react';
import { IconType } from 'react-icons';

// Keep the interface structure for clarity even if not all props are used internally in this version
interface FeatureCardProps {
  title: string;
  description: string | React.ReactNode; // Allow React nodes for richer descriptions
  href: string;
  icon?: IconType; // Icon is now optional, main page can handle it
  accentColorClass: { // Accepts the accent color object
    hoverBorder: string;
    textColor: string;
    bgColor: string;
  };
  children?: React.ReactNode; // Allow children to pass custom content layout
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  href,
  icon: Icon,
  accentColorClass,
  children // Use children prop
}) => {
  // Icon background color logic (kept for potential internal use or consistency)
  const iconBgColorClass = `${accentColorClass.bgColor} bg-opacity-20`;

  return (
    <Link href={href} className="block h-full"> {/* Make the whole card a link and ensure height */}
      <div
        className={`
          bg-white
          rounded-lg
          p-6 md:p-8 // Use padding guideline
          shadow-md
          hover:shadow-lg
          border-2 border-transparent // Default transparent border
          ${accentColorClass.hoverBorder} // Hover border color
          transition-all duration-300 ease-in-out
          transform hover:-translate-y-1 // Subtle lift on hover
          h-full flex flex-col // Make it a flex column to push content down
        `}
      >
        {/* Icon and Title area - can be customized via children */}
        {!children && ( // Default layout if no children are provided
          <>
             {Icon && (
               <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${iconBgColorClass}`}>
                 <Icon className={`${accentColorClass.textColor} text-2xl`} />
               </div>
             )}
            <h3 className="text-xl md:text-2xl font-bold mb-2 text-black">{title}</h3>
            {/* Description now passed as a prop but could also be part of children */}
             {typeof description === 'string' ? (
                 <p className="text-black text-base mb-4 flex-grow">{description}</p> // Use flex-grow
             ) : (
                  <div className="text-black text-base mb-4 flex-grow">{description}</div> // Use flex-grow
             )}
          </>
        )}

        {/* Render children if provided */}
        {children}

        {/* Optional: Add an explicit 'Learn More' link at the bottom */}
        {/* This part is commented out, relying on the whole card link */}
        {/* <span className={`${accentColorClass.textColor} text-sm font-semibold hover:underline mt-auto`}>Learn More →</span> */}
      </div>
    </Link>
  );
};

export default FeatureCard;