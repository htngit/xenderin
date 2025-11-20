'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FadeInProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  triggerKey?: string | number; // Key to trigger re-animation
}

export function FadeIn({
  children,
  className,
  delay = 0,
  duration = 0.5,
  direction = 'up',
  triggerKey
}: FadeInProps) {
  const getInitialPosition = () => {
    switch (direction) {
      case 'up':
        return { opacity: 0, y: 20 };
      case 'down':
        return { opacity: 0, y: -20 };
      case 'left':
        return { opacity: 0, x: 20 };
      case 'right':
        return { opacity: 0, x: -20 };
      default:
        return { opacity: 0 };
    }
  };

  const getFinalPosition = () => {
    switch (direction) {
      case 'up':
      case 'down':
        return { opacity: 1, y: 0 };
      case 'left':
      case 'right':
        return { opacity: 1, x: 0 };
      default:
        return { opacity: 1 };
    }
  };

  return (
    <motion.div
      key={triggerKey} // Re-mount when key changes
      initial={getInitialPosition()}
      animate={getFinalPosition()}
      transition={{
        duration,
        delay,
        ease: 'easeOut'
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

interface StaggerProps {
  children: React.ReactNode | React.ReactNode[];
  className?: string;
  staggerDelay?: number;
  initialDelay?: number;
}

export function Stagger({
  children,
  className,
  staggerDelay = 0.1,
  initialDelay = 0
}: StaggerProps) {
  return (
    <div className={cn(className)}>
      {React.Children.map(children, (child, index) => (
        <FadeIn
          key={index}
          delay={initialDelay + (index * staggerDelay)}
        >
          {child}
        </FadeIn>
      ))}
    </div>
  );
}