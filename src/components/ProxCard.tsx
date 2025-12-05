import React from 'react';
import { cn } from '@/lib/utils';

interface ProxCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ProxCard({ children, className, ...props }: ProxCardProps) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground rounded-prox border border-border/50 p-6 shadow-soft hover:shadow-medium transition-all duration-300",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function ProxCardHeader({ children, className, ...props }: ProxCardProps) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 pb-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function ProxCardTitle({ children, className, ...props }: ProxCardProps) {
  return (
    <h3
      className={cn(
        "text-xl font-semibold leading-none tracking-tight text-black font-primary",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function ProxCardContent({ children, className, ...props }: ProxCardProps) {
  return (
    <div className={cn("pt-0", className)} {...props}>
      {children}
    </div>
  );
}

export function ProxCardFooter({ children, className, ...props }: ProxCardProps) {
  return (
    <div
      className={cn("flex items-center pt-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}