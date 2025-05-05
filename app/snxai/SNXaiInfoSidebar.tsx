// /home/user/new-skill-fire/app/snxai/SNXaiInfoSidebar.tsx

import React from 'react'; // Import React
import styles from './snxaiInfoSidebar.module.css'; // Import the CSS module
// Import icons from lucide-react
import {
    BrainCircuit, Search, FileText, User, Award, FilePlus, MessageSquarePlus,
    BookOpen, Telescope, Code, FlaskConical, Lightbulb, X, Info
} from 'lucide-react';

// Define the props the component accepts
interface SNXaiInfoSidebarProps {
    isOpen: boolean; // Boolean to control sidebar visibility
    onClose: () => void; // Function to call when the sidebar should close
}

// SNXai Information Sidebar Component
const SNXaiInfoSidebar: React.FC<SNXaiInfoSidebarProps> = ({ isOpen, onClose }) => {
    return (
        // Use a React Fragment <> to render the overlay and sidebar as siblings
        <>
            {/* Overlay - Render only when sidebar is open for optimization */}
            {/* The overlay darkens the main content and allows clicking outside to close */}
            {isOpen && (
                <div
                    // Apply CSS Module classes for styling and making it visible
                    className={`${styles.overlay} ${styles.overlayVisible}`}
                    onClick={onClose} // Close sidebar when overlay is clicked
                    aria-hidden="true" // Hide from screen readers when sidebar is closed
                />
            )}


            {/* Sidebar - The main sliding panel */}
            {/* Apply CSS Module classes for styling and animation based on isOpen state */}
            <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>

                {/* Sidebar Header */}
                <div className={styles.header}>
                    {/* Header Icon */}
                    {/* Use featureIcon style for consistent color and potential base size */}
                    <BrainCircuit size={24} className={styles.featureIcon} />
                    {/* Title */}
                    <h2 className={styles.title}>About SNXai</h2>
                    {/* Close Button */}
                    {/* Uses CSS Module class for styling and positioning */}
                    <button onClick={onClose} className={styles.closeButton} aria-label="Close info sidebar">
                        <X size={20} /> {/* Close icon */}
                    </button>
                </div>

                {/* Introduction Text */}
                <p className={styles.introduction}>
                    I'm SNXai, your intelligent assistant for navigating Skill Nexus!
                    I can help you find information and even perform actions for you.
                    Just ask me in plain language.
                </p>

                {/* "What I Can Do" Section */}
                <h3 className={styles.sectionTitle}>What I Can Do</h3>
                <ul className={styles.featureList}>
                    {/* List of implemented features with icons */}
                    <li className={styles.featureItem}>
                        <Search className={styles.featureIcon} />
                        <span className={styles.featureDescription}>Search for projects by skill, keyword, or status.</span>
                    </li>
                    <li className={styles.featureItem}>
                        <Telescope className={styles.featureIcon} />
                        <span className={styles.featureDescription}>Find placement drives by company, role, or branch.</span>
                    </li>
                    <li className={styles.featureItem}>
                        <BookOpen className={styles.featureIcon} />
                        <span className={styles.featureDescription}>Look up shared resources like notes or videos.</span>
                    </li>
                     <li className={styles.featureItem}>
                        <Award className={styles.featureIcon} />
                        <span className={styles.featureDescription}>Find student achievements and success stories.</span>
                    </li>
                     <li className={styles.featureItem}>
                        <User className={styles.featureIcon} />
                        <span className={styles.featureDescription}>Get your profile summary or headline.</span>
                    </li>
                    <li className={styles.featureItem}>
                        <User className={styles.featureIcon} />
                        <span className={styles.featureDescription}>Update your profile summary (e.g., "Update my summary to...")</span>
                    </li>
                    <li className={styles.featureItem}>
                        <MessageSquarePlus className={styles.featureIcon} />
                        <span className={styles.featureDescription}>Create a new community post (I'll open the form).</span>
                    </li>
                    <li className={styles.featureItem}>
                        <FilePlus className={styles.featureIcon} />
                        <span className={styles.featureDescription}>Start a new project (I'll open the form).</span>
                    </li>
                </ul>

                 {/* "Coming Soon" Section */}
                 <h3 className={styles.sectionTitle}>Coming Soon</h3>
                 <ul className={styles.featureList}>
                     {/* List of planned features with icons */}
                     <li className={styles.featureItem}>
                         <FlaskConical className={styles.featureIcon} />
                         <span className={`${styles.featureDescription} ${styles.comingSoon}`}>Compare projects or placement details.</span>
                     </li>
                     <li className={styles.featureItem}>
                         <Code className={styles.featureIcon} />
                         <span className={`${styles.featureDescription} ${styles.comingSoon}`}>Search users by specific skills.</span>
                     </li>
                     {/* Add more planned features as needed */}
                 </ul>

                 {/* "Tips" Section */}
                 <h3 className={styles.sectionTitle}>Tips</h3>
                  <ul className={styles.featureList}>
                      {/* List of tips with icons */}
                      <li className={styles.featureItem}>
                          <Lightbulb className={styles.featureIcon} /> {/* Use Lightbulb icon */}
                          <span className={styles.featureDescription}>Be specific! "Find React projects in progress" works better than just "projects".</span>
                      </li>
                      <li className={styles.featureItem}>
                           <Lightbulb className={styles.featureIcon} /> {/* Use Lightbulb icon */}
                          <span className={styles.featureDescription}>I can remember our conversation context.</span>
                      </li>
                       {/* Add more tips as needed */}
                  </ul>

            </aside>
        </>
    );
};

export default SNXaiInfoSidebar;