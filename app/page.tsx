// app/page.tsx
"use client"; // Ensure this is the very first line

// Standard React/Next Imports
import React, { useEffect } from 'react';
import NextLink from 'next/link';

// Third-party Library Imports
import { Link as ScrollLink, Element, Events, scrollSpy } from 'react-scroll';
import { Fade, Slide, Zoom, Bounce } from 'react-awesome-reveal';
import {
  IoBookOutline, IoPeopleOutline, IoRocketOutline, IoCodeSlashOutline,
  IoSparklesOutline, IoBulbOutline, IoCheckmarkCircleOutline, IoSchoolOutline,
  IoBriefcaseOutline, IoChatbubblesOutline
} from 'react-icons/io5';

// Component Constants and Configuration
const ACCENT_COLORS = {
  blue: {
    textColor: 'text-[#0070F3]', bgColor: 'bg-[#0070F3]',
    bgGradient: 'bg-gradient-to-br from-blue-500 to-blue-700',
    bgLightGradient: 'bg-gradient-to-br from-blue-50 to-blue-100',
    border: 'border-[#0070F3]',
  },
  pink: {
    textColor: 'text-[#FF4081]', bgColor: 'bg-[#FF4081]',
    bgGradient: 'bg-gradient-to-br from-pink-500 to-pink-700',
    bgLightGradient: 'bg-gradient-to-br from-pink-50 to-pink-100',
    border: 'border-[#FF4081]',
  },
  green: {
    textColor: 'text-[#4CAF50]', bgColor: 'bg-[#4CAF50]',
    bgGradient: 'bg-gradient-to-br from-green-500 to-green-700',
    bgLightGradient: 'bg-gradient-to-br from-green-50 to-green-100',
    border: 'border-[#4CAF50]',
  },
   gray: {
     textColor: 'text-gray-700', bgColor: 'bg-gray-700',
     bgGradient: 'bg-gradient-to-br from-gray-700 to-gray-900',
     bgLightGradient: 'bg-gradient-to-br from-gray-50 to-gray-100',
     border: 'border-gray-700',
  },
  text: {
    light: 'text-black', dark: 'text-white',
    mutedLight: 'text-gray-700', mutedDark: 'text-gray-300',
  },
   background: {
     light: 'bg-white',
     lightGradient: 'bg-gradient-to-br from-white to-gray-50',
   }
};

const sections = [
  { id: 'hero', label: 'Welcome' }, { id: 'value-proposition', label: 'Why Skill Nexus?' },
  { id: 'vision', label: 'Our Vision' }, { id: 'learning', label: 'Learning Pages' },
  { id: 'community', label: 'Community Feed' }, { id: 'placements', label: 'Placements Hub' },
  { id: 'projects', label: 'Projects' }, { id: 'nexai', label: 'Meet Nexai' },
];

const placeholderProjects = [
    { id: 1, title: 'Automated Gradebook', link: '/projects/1' }, { id: 2, title: 'Smart Attendance', link: '/projects/2' },
    { id: 3, title: 'E-commerce Platform', link: '/projects/3' }, { id: 4, title: 'Sentiment Analyzer', link: '/projects/4' },
];

// The Component Function
const HomePage: React.FC = () => {

    useEffect(() => {
      Events.scrollEvent.register('begin', () => {});
      Events.scrollEvent.register('end', () => {});
      scrollSpy.update();
      return () => {
        Events.scrollEvent.remove('begin');
        Events.scrollEvent.remove('end');
      };
    }, []);

    // The return statement, starting the JSX
    return (
      <div className={`${ACCENT_COLORS.text.light} font-sans antialiased`}>

        {/* --- Sidebar --- */}
        <div className="hidden md:block fixed left-0 top-1/2 transform -translate-y-1/2 z-50 ml-2">
          <nav className="dot-sidebar-nav"> {/* Class defined in globals.css */}
            {sections.map((section) => (
              <ScrollLink
                key={section.id}
                activeClass="active" // Active state class from globals.css
                className="dot-sidebar-link" // Base dot style from globals.css
                to={section.id}
                spy={true} smooth={true} duration={500} offset={-70}
                data-tooltip={section.label} // Tooltip text
              />
            ))}
          </nav>
        </div>

        {/* --- Main Content --- */}
        <main className={`relative ${ACCENT_COLORS.background.lightGradient} min-h-screen overflow-hidden`}>
          <div className="container mx-auto px-4 md:px-8 pt-20 pb-12">

            {/* --- Hero Section --- */}
            <Element name="hero">
               <section className="text-center py-20 md:py-32 mb-20 md:mb-24 max-w-5xl mx-auto">
                  <Fade direction="down" triggerOnce>
                     <h1 className={`text-4xl md:text-6xl font-extrabold mb-6 leading-tight ${ACCENT_COLORS.text.light}`}>
                       <span className={`${ACCENT_COLORS.blue.textColor}`}>Skill Nexus</span>: Your AI-Augmented Ecosystem for Learning & Networking
                     </h1>
                   </Fade>
                   <Fade direction="up" delay={200} triggerOnce>
                     <p className={`text-lg md:text-xl mb-10 ${ACCENT_COLORS.text.mutedLight}`}>
                       Connecting students and teachers through Project-Based Learning, academic collaboration, streamlined placements, and intelligent support. Unlock your potential with our integrated platform.
                     </p>
                   </Fade>
                   <Bounce delay={400} triggerOnce>
                     <NextLink href="/auth/signin" className={`inline-block ${ACCENT_COLORS.blue.bgColor} text-white px-10 py-4 rounded-lg text-xl font-semibold hover:opacity-90 transition-opacity shadow-lg transform hover:scale-105`}>
                       Join Skill Nexus Today
                     </NextLink>
                   </Bounce>
                </section>
            </Element>

            {/* --- Value Proposition Section --- */}
             <Element name="value-proposition">
                 <section className={`${ACCENT_COLORS.gray.bgLightGradient} rounded-lg shadow-md py-16 md:py-20 mb-20 md:mb-24 text-center`}>
                     <div className="max-w-4xl mx-auto px-4 md:px-8">
                         <Fade direction="up" triggerOnce>
                             <h2 className={`text-3xl md:text-4xl font-bold mb-8 ${ACCENT_COLORS.text.light}`}>Unlock Your Potential</h2>
                              <p className={`text-lg ${ACCENT_COLORS.text.mutedLight} text-center max-w-2xl mx-auto mb-12`}>
                                 Skill Nexus empowers you to thrive academically and professionally in a connected environment.
                              </p>
                         </Fade>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                           <Fade direction="left" triggerOnce delay={100}>
                              <div>
                                  <div className={`flex items-center mb-3 ${ACCENT_COLORS.blue.textColor}`}><IoSchoolOutline className="text-3xl mr-2" /><h3 className={`text-xl font-semibold ${ACCENT_COLORS.text.light}`}>Enhanced Learning</h3></div>
                                  <p className="text-base ${ACCENT_COLORS.text.mutedLight}">Streamline PBL/SBL/TBL tracking and project collaboration.</p>
                              </div>
                           </Fade>
                           <Fade direction="up" triggerOnce delay={200}>
                               <div>
                                   <div className={`flex items-center mb-3 ${ACCENT_COLORS.pink.textColor}`}><IoChatbubblesOutline className="text-3xl mr-2" /><h3 className={`text-xl font-semibold ${ACCENT_COLORS.text.light}`}>Active Community</h3></div>
                                   <p className="text-base ${ACCENT_COLORS.text.mutedLight}">Stay connected, share updates, and network with peers and staff.</p>
                               </div>
                            </Fade>
                            <Fade direction="right" triggerOnce delay={300}>
                               <div>
                                  <div className={`flex items-center mb-3 ${ACCENT_COLORS.green.textColor}`}><IoBriefcaseOutline className="text-3xl mr-2" /><h3 className={`text-xl font-semibold ${ACCENT_COLORS.text.light}`}>Career Ready</h3></div>
                                  <p className="text-base ${ACCENT_COLORS.text.mutedLight}">Track placements, build your profile, and get discovered.</p>
                              </div>
                            </Fade>
                          </div>
                     </div>
                 </section>
             </Element>

            {/* --- Vision Section --- */}
             <Element name="vision">
                 <section className={`${ACCENT_COLORS.gray.bgGradient} ${ACCENT_COLORS.text.dark} rounded-lg shadow-xl py-16 md:py-20 mb-20 md:mb-24`}>
                    <div className="max-w-4xl mx-auto px-4 md:px-8 text-center">
                      <Fade direction="up" triggerOnce>
                         <div className="flex items-center justify-center mb-8 ${ACCENT_COLORS.text.dark}"><IoBulbOutline className="text-5xl mr-4" /><h2 className={`text-3xl md:text-4xl font-bold`}>Our Vision</h2></div>
                      </Fade>
                       <Fade direction="up" delay={200} triggerOnce>
                         <p className={`text-lg ${ACCENT_COLORS.text.mutedDark} text-center max-w-2xl mx-auto mb-12`}>
                            We're building a platform that transforms the college experience by breaking down silos and empowering users with smart tools and connections.
                         </p>
                       </Fade>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                          <Fade direction="left" triggerOnce>
                             <div>
                                <div className={`flex items-center justify-center mb-4 ${ACCENT_COLORS.pink.textColor}`}><IoBulbOutline className="text-4xl mr-2" /><h3 className={`text-xl font-semibold ${ACCENT_COLORS.text.dark}`}>The Challenge</h3></div>
                                <ul className={`text-base ${ACCENT_COLORS.text.mutedDark} list-none space-y-2 px-0 text-left`}>
                                   <li>Disconnected academic tools.</li><li>Finding relevant projects/clubs is hard.</li>
                                   <li>Struggling to showcase practical skills.</li><li>Limited placement/networking visibility.</li>
                                </ul>
                             </div>
                          </Fade>
                          <Fade direction="right" triggerOnce>
                             <div>
                                <div className={`flex items-center justify-center mb-4 ${ACCENT_COLORS.green.textColor}`}><IoCheckmarkCircleOutline className="text-4xl mr-2" /><h3 className={`text-xl font-semibold ${ACCENT_COLORS.text.dark}`}>Our Solution</h3></div>
                                <ul className={`text-base ${ACCENT_COLORS.text.mutedDark} list-none space-y-2 px-0 text-left`}>
                                   <li>Integrated ecosystem for all needs.</li><li>AI-powered discovery of opportunities.</li>
                                   <li>Structured dashboard for skill showcase.</li><li>Centralized hub for placements & networking.</li>
                                </ul>
                             </div>
                          </Fade>
                       </div>
                    </div>
                 </section>
             </Element>

            {/* --- Features Section Wrapper --- */}
            <section className="mb-20 md:mb-24">
              <Fade direction="up" triggerOnce>
                 <h2 className={`text-3xl md:text-4xl font-bold text-center mb-12 md:mb-16 ${ACCENT_COLORS.text.light}`}>Explore the Ecosystem Features</h2>
              </Fade>

              {/* Learning Pages Feature */}
              <Element name="learning">
                <Fade direction="up" triggerOnce>
                  <div className={`${ACCENT_COLORS.blue.bgLightGradient} rounded-lg shadow-md py-16 md:py-20 mb-16 md:mb-20`}>
                     <div className="max-w-6xl mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                        <div>
                           <div className={`flex items-center mb-4 ${ACCENT_COLORS.blue.textColor}`}><IoBookOutline className="text-4xl mr-3" /><h3 className={`text-3xl font-bold ${ACCENT_COLORS.text.light}`}>Learning Pages</h3></div>
                           <p className={`text-lg ${ACCENT_COLORS.text.mutedLight} mb-6`}>Digitize your Project-Based, Skill-Based, and Task-Based Learning modules. Teachers can create pages, define custom fields, and students can easily submit progress entries and receive feedback, mimicking a classroom workflow.</p>
                           <h4 className={`text-xl font-semibold mb-3 ${ACCENT_COLORS.text.light}`}>How it works:</h4>
                           <ol className={`list-decimal list-inside text-base ${ACCENT_COLORS.text.mutedLight} space-y-2`}>
                              <li><span className="font-semibold">Create/Join:</span> Teachers set up pages; students join with a code.</li>
                              <li><span className="font-semibold">Define Structure:</span> Teachers add custom fields for entries (e.g., 'Weekly Goals', 'Challenges').</li>
                              <li><span className="font-semibold">Submit Progress:</span> Students fill out custom fields, add temporary file metadata (future: actual files), and submit entries weekly.</li>
                              <li><span className="font-semibold">Review & Guide:</span> Teachers track submissions, provide inline feedback on entries.</li>
                              <li><span className="font-semibold">Communicate:</span> Use the stream for announcements and the sidebar for Q&A.</li>
                           </ol>
                           <NextLink href="/learning" className={`inline-block mt-6 ${ACCENT_COLORS.blue.textColor} border-2 ${ACCENT_COLORS.blue.border} px-6 py-3 rounded-md text-lg font-semibold hover:bg-blue-100 transition-colors transform hover:-translate-y-1`}>Explore Learning Pages →</NextLink>
                        </div>
                        <div className="order-first md:order-last"><div className={`${ACCENT_COLORS.blue.bgGradient} h-60 md:h-80 rounded-lg flex items-center justify-center text-blue-100 italic shadow-inner`}>[Placeholder: Learning Page UI Mockup]</div></div>
                     </div>
                  </div>
                </Fade>
              </Element>

              {/* Community Feed Feature */}
              <Element name="community">
                <Fade direction="up" triggerOnce>
                  <div className={`${ACCENT_COLORS.pink.bgGradient} ${ACCENT_COLORS.text.dark} rounded-lg shadow-md py-16 md:py-20 mb-16 md:mb-20`}>
                     <div className="max-w-6xl mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                        <div><div className={`${ACCENT_COLORS.pink.bgLightGradient} h-60 md:h-80 rounded-lg flex items-center justify-center text-pink-700 italic shadow-inner`}>[Placeholder: Community Feed UI Mockup]</div></div>
                        <div>
                            <div className={`flex items-center mb-4 ${ACCENT_COLORS.text.dark}`}><IoPeopleOutline className="text-4xl mr-3" /><h3 className={`text-3xl font-bold ${ACCENT_COLORS.text.dark}`}>Community Feed</h3></div>
                            <p className={`text-lg ${ACCENT_COLORS.text.mutedDark} mb-6`}>A vibrant space to share campus updates, announce events, and connect with fellow students and college staff. Stay informed, react to posts, and engage in discussions.</p>
                             <h4 className={`text-xl font-semibold mb-3 ${ACCENT_COLORS.text.dark}`}>How it works:</h4>
                            <ol className={`list-decimal list-inside text-base ${ACCENT_COLORS.text.mutedDark} space-y-2`}>
                               <li><span className="font-semibold">Post Updates:</span> Share text, links, events, and temporary media previews (future: actual media) with the community.</li>
                               <li><span className="font-semibold">Browse & Filter:</span> Scroll through the feed, filter by category or search to find relevant information.</li>
                               <li><span className="font-semibold">Engage & Discuss:</span> Like posts, open a modal for full details, and participate in comment threads.</li>
                            </ol>
                            <NextLink href="/community" className={`inline-block mt-6 ${ACCENT_COLORS.pink.textColor} border-2 ${ACCENT_COLORS.pink.border} px-6 py-3 rounded-md text-lg font-semibold ${ACCENT_COLORS.text.dark} hover:bg-pink-800 transition-colors transform hover:-translate-y-1`}>Explore Community Feed →</NextLink>
                        </div>
                     </div>
                   </div>
                 </Fade>
               </Element>

               {/* Placements Hub Feature */}
               <Element name="placements">
                 <Fade direction="up" triggerOnce>
                   <div className={`${ACCENT_COLORS.green.bgLightGradient} rounded-lg shadow-md py-16 md:py-20 mb-16 md:mb-20`}>
                     <div className="max-w-6xl mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                        <div>
                           <div className={`flex items-center mb-4 ${ACCENT_COLORS.green.textColor}`}><IoRocketOutline className="text-4xl mr-3" /><h3 className={`text-3xl font-bold ${ACCENT_COLORS.text.light}`}>Placements Hub</h3></div>
                           <p className={`text-lg ${ACCENT_COLORS.text.mutedLight} mb-6`}>Your central resource for career opportunities. Find detailed information on placement drives, company profiles, and connect for Q&A. Celebrate successes with the achievement feed.</p>
                           <h4 className={`text-xl font-semibold mb-3 ${ACCENT_COLORS.text.light}`}>How it works:</h4>
                           <ol className={`list-decimal list-inside text-base ${ACCENT_COLORS.text.mutedLight} space-y-2`}>
                              <li><span className="font-semibold">Browse Drives:</span> Explore current and past drives with filters (company, role, status).</li>
                              <li><span className="font-semibold">View Details:</span> Access full information including eligibility, dates, package, and application links.</li>
                              <li><span className="font-semibold">Ask Questions:</span> Use the dedicated Q&A chat sidebar for specific drive queries.</li>
                              <li><span className="font-semibold">Share Success:</span> Students post their placement achievements to inspire the community.</li>
                              <li><span className="font-semibold">Admin Management:</span> Authorized staff manage drive listings and updates.</li>
                           </ol>
                           <NextLink href="/placements" className={`inline-block mt-6 ${ACCENT_COLORS.green.textColor} border-2 ${ACCENT_COLORS.green.border} px-6 py-3 rounded-md text-lg font-semibold hover:bg-green-100 transition-colors transform hover:-translate-y-1`}>Explore Placements Hub →</NextLink>
                        </div>
                        <div className="order-first md:order-last"><div className={`${ACCENT_COLORS.green.bgGradient} h-60 md:h-80 rounded-lg flex items-center justify-center text-green-100 italic shadow-inner`}>[Placeholder: Placements Hub UI Mockup]</div></div>
                     </div>
                   </div>
                 </Fade>
               </Element>

            </section>

            {/* --- Projects Showcase Section (Simplified) --- */}
            <Element name="projects">
               <Fade direction="up" triggerOnce>
                  <section className={`${ACCENT_COLORS.gray.bgGradient} ${ACCENT_COLORS.text.dark} py-16 md:py-20 rounded-lg shadow-xl mb-20 md:mb-24 text-center`}>
                     <div className="max-w-4xl mx-auto px-4 md:px-8">
                        <Fade direction="up" triggerOnce>
                           <div className="flex items-center justify-center mb-8 ${ACCENT_COLORS.text.dark}"><IoCodeSlashOutline className="text-5xl mr-4" /><h2 className={`text-3xl md:text-4xl font-bold`}>Projects Showcase</h2></div>
                           <p className={`text-lg ${ACCENT_COLORS.text.mutedDark} text-center max-w-2xl mx-auto mb-12`}>Showcase your technical skills and explore inspiring student work.</p>
                        </Fade>
                        <Fade direction="up" delay={200} triggerOnce>
                            <div className="mt-8 text-center max-w-3xl mx-auto">
                                <h4 className={`text-xl font-semibold mb-3 ${ACCENT_COLORS.text.dark}`}>How it works:</h4>
                                <ol className={`list-decimal list-inside text-base ${ACCENT_COLORS.text.mutedDark} space-y-2 text-left inline-block`}>
                                   <li><span className="font-semibold">Create Project:</span> Add detailed listings for your academic and personal projects.</li>
                                   <li><span className="font-semibold">Explore Projects:</span> Browse projects created by others, filter by technology, type, etc.</li>
                                   <li><span className="font-semibold">View Details:</span> See project descriptions, technologies, links, team members, updates, and Q&A.</li>
                                </ol>
                                <NextLink href="/projects" className={`inline-block mt-6 ${ACCENT_COLORS.blue.textColor} border-2 ${ACCENT_COLORS.blue.border} px-6 py-3 rounded-md text-lg font-semibold ${ACCENT_COLORS.text.dark} hover:bg-blue-800 transition-colors transform hover:-translate-y-1`}>Explore All Projects →</NextLink>
                           </div>
                        </Fade>
                     </div>
                  </section>
               </Fade>
            </Element>

            {/* --- Meet Nexai Section --- */}
             <Element name="nexai">
               <Fade direction="up" triggerOnce>
                 <section className={`${ACCENT_COLORS.pink.bgLightGradient} ${ACCENT_COLORS.text.light} py-16 md:py-20 rounded-lg shadow-md mb-20 md:mb-24`}>
                    <div className="max-w-6xl mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                         <div className="order-first md:order-last"><div className={`${ACCENT_COLORS.pink.bgGradient} h-60 md:h-80 rounded-lg flex items-center justify-center text-pink-100 italic shadow-inner`}>[Placeholder: Nexai Interface/AI Graphic]</div></div>
                        <div>
                            <div className={`flex items-center mb-4 ${ACCENT_COLORS.pink.textColor}`}><IoSparklesOutline className="text-4xl mr-3" /><h3 className={`text-3xl font-bold ${ACCENT_COLORS.text.light}`}>Meet Nexai: Your Intelligent Co-Pilot</h3></div>
                            <p className={`text-lg ${ACCENT_COLORS.text.mutedLight} mb-6`}>Nexai is your AI-powered assistant integrated directly into Skill Nexus, designed to help you navigate the platform and enhance your academic journey.</p>
                            <h4 className={`text-xl font-semibold mb-3 ${ACCENT_COLORS.text.light}`}>Current Capabilities:</h4>
                            <ul className={`list-disc list-inside text-base ${ACCENT_COLORS.text.mutedLight} mb-6 space-y-1`}>
                               <li>Instant answers to questions about the platform or general academic queries.</li><li>Accessible chat interface for quick help.</li>
                            </ul>
                            <h4 className={`text-xl font-semibold mb-3 ${ACCENT_COLORS.blue.textColor}`}>Future Vision: Agentic AI</h4>
                             <p className={`text-base ${ACCENT_COLORS.text.mutedLight} mb-6`}>We're evolving Nexai into an agentic AI that can actively help you by <span className="font-semibold">recommending relevant projects, resources, clubs, and placement drives</span> based on your profile and interests, suggesting collaborators, and alerting you to new opportunities.</p>
                            <NextLink href="/nexai" className={`inline-block mt-6 ${ACCENT_COLORS.pink.textColor} border-2 ${ACCENT_COLORS.pink.border} px-6 py-3 rounded-md text-lg font-semibold hover:bg-pink-100 transition-colors transform hover:-translate-y-1`}>Talk to Nexai →</NextLink>
                        </div>
                    </div>
                 </section>
               </Fade>
             </Element>

            {/* --- Final Call to Action Section --- */}
             <Fade direction="up" triggerOnce>
               <section className={`${ACCENT_COLORS.blue.bgGradient} ${ACCENT_COLORS.text.dark} py-16 md:py-20 rounded-lg shadow-xl text-center`}>
                  <div className="max-w-4xl mx-auto px-4">
                     <h2 className={`text-3xl md:text-4xl font-bold mb-8 ${ACCENT_COLORS.text.dark}`}>Ready to Transform Your College Experience?</h2>
                     <Bounce delay={200} triggerOnce>
                       <NextLink href="/auth/signin" className={`inline-block ${ACCENT_COLORS.gray.bgColor} text-white px-10 py-4 rounded-lg text-xl font-semibold hover:opacity-90 transition-opacity shadow-lg transform hover:scale-105`}>Get Started with Skill Nexus</NextLink>
                     </Bounce>
                  </div>
               </section>
             </Fade>

          </div> {/* End inner container div */}
       </main>
     </div> // End root div
   ); // End return
 }; // End HomePage Component

 export default HomePage;