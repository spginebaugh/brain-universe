import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { Node, useStoreApi } from '@xyflow/react';
import { FlowNodeData } from '../types/workspace-types';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/components/ui/card';

interface NodeInfoPopupProps {
  node: Node<FlowNodeData>;
  onAnimationComplete: (nodeId: string) => void;
}

export const NodeInfoPopup = ({ node, onAnimationComplete }: NodeInfoPopupProps) => {
  const [displayedTitle, setDisplayedTitle] = useState('');
  const [displayedDescription, setDisplayedDescription] = useState('');
  const [displayedContent, setDisplayedContent] = useState('');
  const [animationStage, setAnimationStage] = useState<'fade-in' | 'title' | 'description' | 'content' | 'complete'>('fade-in');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);
  
  // Add content ref for auto-scrolling
  const contentRef = useRef<HTMLDivElement>(null);
  
  const store = useStoreApi();
  
  // Get the node's properties and content
  const { properties, content } = node.data;
  const title = properties.title || '';
  const description = properties.description || '';
  const mainText = (content.mainText as string) || (content.text as string) || '';

  // Get the node's background color for styling
  const nodeBackground = node.style?.background || '#e0f2e9';
  
  // Create color variants for different parts of the popup
  const cardBgColor = `${nodeBackground}95`; // 95% opacity version
  const contentBgColor = `${nodeBackground}50`; // 50% opacity version
  const borderColor = typeof nodeBackground === 'string' ? nodeBackground : '#e0f2e9';

  // Handle fade-in animation
  useEffect(() => {
    if (animationStage === 'fade-in') {
      // Start with node highlight and fade in
      setOpacity(0);
      
      const fadeInTimer = setTimeout(() => {
        setOpacity(1);
        setAnimationStage('title');
      }, 500); // Reduced timing
      
      return () => clearTimeout(fadeInTimer);
    }
  }, [animationStage]);

  // Calculate position
  useEffect(() => {
    const calculatePosition = () => {
      const { transform } = store.getState();
      const zoom = transform[2];
      
      // Calculate position in viewport coordinates
      const nodeX = node.position.x * zoom + transform[0];
      const nodeY = node.position.y * zoom + transform[1];
      
      // Position the popup to the right of the node with some spacing
      const nodeWidth = (node.width || 150) * zoom;
      const offsetX = nodeWidth + 20; // Add some spacing
      
      setPosition({ 
        x: nodeX + offsetX,
        y: nodeY - 20 // Slight upward offset
      });
    };
    
    calculatePosition();
    
    // Re-calculate on viewport changes
    const unsubscribe = store.subscribe(calculatePosition);
    
    return () => unsubscribe();
  }, [node, store]);
  
  // Handle the typing animation for the title
  useEffect(() => {
    if (animationStage !== 'title') return;
    
    let currentIndex = 0;
    const titleInterval = setInterval(() => {
      if (currentIndex < title.length) {
        setDisplayedTitle(title.substring(0, currentIndex + 1));
        currentIndex += 3; // Increased from 5 to 8 characters at once for faster animation
      } else {
        setDisplayedTitle(title); // Ensure the full title is displayed
        clearInterval(titleInterval);
        setAnimationStage('description');
      }
    }, 9); // Keep at minimum interval for fastest animation
    
    return () => clearInterval(titleInterval);
  }, [title, animationStage]);
  
  // Handle the typing animation for the description
  useEffect(() => {
    if (animationStage !== 'description') return;
    
    let currentIndex = 0;
    const descriptionInterval = setInterval(() => {
      if (currentIndex < description.length) {
        setDisplayedDescription(description.substring(0, currentIndex + 1));
        currentIndex += 5; // Increased from 10 to 15 characters at once for faster animation
      } else {
        setDisplayedDescription(description); // Ensure the full description is displayed
        clearInterval(descriptionInterval);
        setAnimationStage('content');
      }
    }, 8); // Keep at minimum interval for fastest animation
    
    return () => clearInterval(descriptionInterval);
  }, [description, animationStage]);
  
  // Handle the typing animation for the main content - EXTREMELY FAST
  useEffect(() => {
    if (animationStage !== 'content') return;
    
    // Start with empty content
    setDisplayedContent('');
    
    // Much larger chunk size for ultra-fast animation
    const chunkSize = Math.max(40, Math.floor(mainText.length / 25)); // Doubled chunk size for faster animation
    let currentIndex = 0;
    
    const contentInterval = setInterval(() => {
      if (currentIndex < mainText.length) {
        currentIndex += chunkSize;
        const newContent = mainText.substring(0, currentIndex);
        setDisplayedContent(newContent);
      } else {
        clearInterval(contentInterval);
        setAnimationStage('complete');
        // Reduced delay before completion callback for faster parallel animations
        setTimeout(() => onAnimationComplete(node.id), 250);
      }
    }, 1); // Keep the fastest possible interval
    
    return () => clearInterval(contentInterval);
  }, [mainText, animationStage, onAnimationComplete, node.id]);
  
  // This effect runs after EVERY render to ensure scrolling is always at the bottom
  useLayoutEffect(() => {
    if (contentRef.current && animationStage === 'content') {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  });
  
  return (
    <>
      {/* Info popup - WIDER SIZE */}
      <div 
        className="absolute z-50 pointer-events-auto"
        style={{
          left: position.x,
          top: position.y,
          width: '500px', // Increased width from 450px to 500px
          maxWidth: '45vw', // Increased max width to ensure it fits on smaller screens
          transform: `translateY(-50%)`,
          transition: 'all 0.4s ease-in-out, opacity 0.6s ease-in-out',
          opacity: opacity
        }}
      >
        <Card 
          className="shadow-lg border-2 backdrop-blur-sm"
          style={{
            borderColor: borderColor,
            background: cardBgColor
          }}
        >
          <CardHeader className="pb-2 px-4">
            <CardTitle className="text-lg font-bold break-words overflow-visible">{displayedTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4">
            {displayedDescription && (
              <p className="text-sm text-gray-600 break-words whitespace-pre-wrap overflow-visible">{displayedDescription}</p>
            )}
            {/* Fixed height content area with auto-scroll */}
            <div 
              ref={contentRef}
              className="text-sm whitespace-pre-wrap h-[250px] overflow-y-auto overflow-x-hidden pr-2 pointer-events-auto scroll-smooth"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: `${nodeBackground} transparent`,
                position: 'relative',
                borderRadius: '0.25rem',
                padding: '0.5rem',
                background: contentBgColor,
                boxShadow: 'inset 0 0 6px rgba(0, 0, 0, 0.1)'
              }}
            >
              {displayedContent}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}; 